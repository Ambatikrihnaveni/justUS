// ===========================================
// Socket.io Handler
// Manages real-time communication
// ===========================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Call = require('../models/Call');
const { recordInteraction } = require('../controllers/streakController');
const { sendMessageNotification, sendCallNotification, sendMissedCallNotification } = require('../services/pushNotificationService');

// Store online users: Map<userId, socketId>
const onlineUsers = new Map();

// Store active calls: Map<`${userId1}-${userId2}`, { startTime, type }>
const activeCalls = new Map();

// ===========================================
// Initialize Socket Handlers
// ===========================================

const initializeSocket = (io) => {
    // Middleware: Authenticate socket connections
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');

            if (!user) {
                return next(new Error('User not found'));
            }

            // Attach user to socket
            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    // ===========================================
    // Connection Event
    // ===========================================

    io.on('connection', async (socket) => {
        const userId = socket.user._id.toString();
        console.log(`🟢 User connected: ${socket.user.name} (${userId})`);

        // Add user to online users map
        onlineUsers.set(userId, socket.id);

        // Join user's personal room (for receiving messages)
        socket.join(userId);

        // Mark all undelivered messages TO this user as delivered and notify about them
        try {
            // Get pending messages before marking as delivered
            const pendingMessages = await Message.find({ 
                receiverId: userId, 
                delivered: false 
            }).populate('senderId', 'name avatar');
            
            // Mark as delivered
            const undeliveredMessages = await Message.updateMany(
                { receiverId: userId, delivered: false },
                { delivered: true, deliveredAt: new Date() }
            );
            
            if (undeliveredMessages.modifiedCount > 0) {
                console.log(`📬 Marked ${undeliveredMessages.modifiedCount} messages as delivered to ${socket.user.name}`);
                
                // Send pending messages to the user so they can show notifications
                if (pendingMessages.length > 0) {
                    socket.emit('pendingMessages', pendingMessages);
                }
                
                // Get unique senders to notify them
                const messages = await Message.find({ receiverId: userId, delivered: true, seen: false })
                    .distinct('senderId');
                
                messages.forEach(senderId => {
                    io.to(senderId.toString()).emit('messagesDelivered', { to: userId });
                });
            }
            
            // Also check for missed calls
            const missedCalls = await Call.find({
                receiverId: userId,
                status: 'missed',
                notified: { $ne: true },
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
            }).populate('callerId', 'name avatar');
            
            if (missedCalls.length > 0) {
                console.log(`📞 Found ${missedCalls.length} missed calls for ${socket.user.name}`);
                socket.emit('missedCalls', missedCalls);
                
                // Mark as notified
                await Call.updateMany(
                    { _id: { $in: missedCalls.map(c => c._id) } },
                    { notified: true }
                );
            }
        } catch (error) {
            console.error('Error marking messages as delivered:', error);
        }

        // Broadcast online status to all users
        io.emit('userOnline', {
            userId,
            name: socket.user.name
        });

        // Send current online users to the connected user
        socket.emit('onlineUsers', Array.from(onlineUsers.keys()));

        // ===========================================
        // Send Message Event
        // ===========================================

        socket.on('sendMessage', async (data) => {
            try {
                const { receiverId, message, type = 'text', filePath = '' } = data;

                // Check if receiver is online
                const isReceiverOnline = onlineUsers.has(receiverId);

                // Create message in database
                const newMessage = await Message.create({
                    senderId: userId,
                    receiverId,
                    message,
                    type,
                    filePath,
                    delivered: isReceiverOnline,
                    deliveredAt: isReceiverOnline ? new Date() : null
                });

                // Populate sender and receiver info
                await newMessage.populate('senderId', 'name avatar');
                await newMessage.populate('receiverId', 'name avatar');

                // Record interaction for streak/miss-you tracking
                if (socket.user.coupleId) {
                    recordInteraction(socket.user.coupleId, 'chat');
                }

                // Send to receiver if online
                if (isReceiverOnline) {
                    io.to(receiverId).emit('newMessage', newMessage);
                } else {
                    // Receiver is offline - send push notification
                    try {
                        const receiver = await User.findById(receiverId).select('fcmToken name');
                        if (receiver?.fcmToken) {
                            await sendMessageNotification(
                                receiver.fcmToken,
                                socket.user.name,
                                message,
                                type
                            );
                            console.log(`📲 Push notification sent to ${receiver.name}`);
                        }
                    } catch (pushError) {
                        console.error('Push notification error:', pushError);
                    }
                }

                // Also send back to sender for confirmation
                socket.emit('messageSent', newMessage);

                console.log(`📨 Message from ${socket.user.name} to ${receiverId} (${isReceiverOnline ? 'delivered' : 'pending+push'})`);
            } catch (error) {
                console.error('Socket sendMessage error:', error);
                socket.emit('messageError', { message: 'Failed to send message' });
            }
        });

        // ===========================================
        // Typing Indicator Events
        // ===========================================

        socket.on('typing', (receiverId) => {
            io.to(receiverId).emit('userTyping', {
                userId,
                name: socket.user.name
            });
        });

        socket.on('stopTyping', (receiverId) => {
            io.to(receiverId).emit('userStoppedTyping', {
                userId
            });
        });

        // ===========================================
        // Mark Messages as Seen
        // ===========================================

        socket.on('markSeen', async (senderId) => {
            try {
                await Message.updateMany(
                    { senderId, receiverId: userId, seen: false },
                    { seen: true, seenAt: new Date(), delivered: true, deliveredAt: new Date() }
                );

                // Notify sender that messages were seen
                io.to(senderId).emit('messagesSeen', { by: userId });
            } catch (error) {
                console.error('Socket markSeen error:', error);
            }
        });

        // ===========================================
        // Voice/Video Call Events
        // ===========================================

        // Helper to get call key
        const getCallKey = (user1, user2) => {
            return [user1, user2].sort().join('-');
        };

        // Initiate a call
        socket.on('callUser', async (data) => {
            const { to, offer, type } = data;
            const targetSocketId = onlineUsers.get(to);
            console.log(`📞 ${socket.user.name} (${userId}) calling ${to} (${type})`);
            console.log(`📞 Target socket ID: ${targetSocketId || 'NOT ONLINE'}`);
            console.log(`📞 Online users:`, Array.from(onlineUsers.entries()));
            
            if (!targetSocketId) {
                console.log(`📞 Target user ${to} is not online`);
                
                // Send push notification for incoming call
                try {
                    const receiver = await User.findById(to).select('fcmToken name');
                    if (receiver?.fcmToken) {
                        await sendCallNotification(
                            receiver.fcmToken,
                            socket.user.name,
                            type,
                            userId
                        );
                        console.log(`📲 Call push notification sent to ${receiver.name}`);
                        
                        // Wait a bit for user to open app
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Check if user came online
                        const newTargetSocketId = onlineUsers.get(to);
                        if (newTargetSocketId) {
                            // User came online, send call
                            const callKey = getCallKey(userId, to);
                            activeCalls.set(callKey, { startTime: Date.now(), type, callerId: userId, receiverId: to });
                            
                            io.to(to).emit('incomingCall', {
                                from: userId,
                                callerName: socket.user.name,
                                offer,
                                type
                            });
                            console.log(`📞 User came online, sent call`);
                            return;
                        }
                    }
                } catch (pushError) {
                    console.error('Call push notification error:', pushError);
                }
                
                socket.emit('callFailed', { reason: 'User is offline' });
                
                // Save as missed call and send missed call notification
                try {
                    await Call.create({
                        callerId: userId,
                        receiverId: to,
                        type,
                        status: 'missed',
                        duration: 0
                    });
                    
                    // Send missed call notification
                    const receiver = await User.findById(to).select('fcmToken name');
                    if (receiver?.fcmToken) {
                        await sendMissedCallNotification(receiver.fcmToken, socket.user.name, type);
                    }
                } catch (err) {
                    console.error('Error saving missed call:', err);
                }
                return;
            }
            
            // Store call start time
            const callKey = getCallKey(userId, to);
            activeCalls.set(callKey, { startTime: Date.now(), type, callerId: userId, receiverId: to });
            
            io.to(to).emit('incomingCall', {
                from: userId,
                callerName: socket.user.name,
                offer,
                type
            });
            
            console.log(`📞 Sent incomingCall event to room ${to}`);
        });

        // Answer a call
        socket.on('answerCall', async (data) => {
            const { to, answer } = data;
            console.log(`📞 ${socket.user.name} answered call from ${to}`);
            
            // Update call start time to now (when actually connected)
            const callKey = getCallKey(userId, to);
            const callData = activeCalls.get(callKey);
            if (callData) {
                callData.startTime = Date.now();
                callData.answered = true;
            }
            
            // Record call interaction for streak tracking
            if (socket.user.coupleId) {
                recordInteraction(socket.user.coupleId, 'call');
            }
            
            io.to(to).emit('callAnswered', {
                from: userId,
                answer
            });
        });

        // Decline a call
        socket.on('declineCall', async (data) => {
            const { to } = data;
            console.log(`📞 ${socket.user.name} declined call from ${to}`);
            
            const callKey = getCallKey(userId, to);
            const callData = activeCalls.get(callKey);
            
            // Save declined call
            if (callData) {
                try {
                    await Call.create({
                        callerId: callData.callerId,
                        receiverId: callData.receiverId,
                        type: callData.type,
                        status: 'declined',
                        duration: 0
                    });
                } catch (err) {
                    console.error('Error saving declined call:', err);
                }
                activeCalls.delete(callKey);
            }
            
            io.to(to).emit('callDeclined', {
                from: userId,
                name: socket.user.name
            });
        });

        // End a call
        socket.on('endCall', async (data) => {
            const { to, duration } = data;
            console.log(`📞 ${socket.user.name} ended call with ${to}, duration: ${duration}s`);
            
            const callKey = getCallKey(userId, to);
            const callData = activeCalls.get(callKey);
            
            // Save completed call
            if (callData) {
                const callDuration = duration || Math.floor((Date.now() - callData.startTime) / 1000);
                try {
                    await Call.create({
                        callerId: callData.callerId,
                        receiverId: callData.receiverId,
                        type: callData.type,
                        status: callData.answered ? 'answered' : 'missed',
                        duration: callDuration,
                        startedAt: new Date(callData.startTime),
                        endedAt: new Date()
                    });
                    console.log(`📞 Call saved: ${callData.type}, ${callDuration}s, ${callData.answered ? 'answered' : 'missed'}`);
                } catch (err) {
                    console.error('Error saving call:', err);
                }
                activeCalls.delete(callKey);
            }
            
            io.to(to).emit('callEnded', {
                from: userId
            });
        });

        // Save call record (called explicitly from frontend)
        socket.on('saveCall', async (data) => {
            const { partnerId, type, status, duration } = data;
            console.log(`📞 Saving call record: ${type}, ${status}, ${duration}s`);
            
            try {
                const call = await Call.create({
                    callerId: status === 'missed' ? partnerId : userId,
                    receiverId: status === 'missed' ? userId : partnerId,
                    type,
                    status,
                    duration: duration || 0
                });
                console.log(`📞 Call record saved:`, call._id);
            } catch (err) {
                console.error('Error saving call record:', err);
            }
        });

        // ICE candidate exchange
        socket.on('iceCandidate', (data) => {
            const { to, candidate } = data;
            console.log(`📞 ICE candidate from ${socket.user.name} to ${to}`, candidate?.candidate?.substring(0, 50));
            
            io.to(to).emit('iceCandidate', {
                from: userId,
                candidate
            });
        });

        // Call busy (user already in a call)
        socket.on('callBusy', (data) => {
            const { to } = data;
            console.log(`📞 ${socket.user.name} is busy`);
            
            io.to(to).emit('callBusy', {
                from: userId,
                name: socket.user.name
            });
        });

        // ===========================================
        // Live Location Events
        // ===========================================

        // Send live location update
        socket.on('liveLocationUpdate', async (data) => {
            const { receiverId, messageId, latitude, longitude, accuracy } = data;
            console.log(`📍 Live location update from ${socket.user.name} to ${receiverId}`);
            
            try {
                // Update the message with new location
                const message = await Message.findById(messageId);
                if (message && message.liveLocationActive && message.senderId.toString() === userId) {
                    message.location = { latitude, longitude, accuracy };
                    await message.save();
                    
                    // Send update to receiver
                    io.to(receiverId).emit('liveLocationUpdate', {
                        messageId,
                        senderId: userId,
                        location: { latitude, longitude, accuracy },
                        timestamp: Date.now()
                    });
                    
                    // Also echo back to sender for confirmation
                    socket.emit('liveLocationUpdate', {
                        messageId,
                        senderId: userId,
                        location: { latitude, longitude, accuracy },
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error('Live location update error:', error);
            }
        });

        // Stop live location sharing
        socket.on('stopLiveLocation', async (data) => {
            const { messageId, receiverId } = data;
            console.log(`📍 Stopping live location for message ${messageId}`);
            
            try {
                const message = await Message.findById(messageId);
                if (message && message.senderId.toString() === userId) {
                    message.liveLocationActive = false;
                    await message.save();
                    
                    // Notify receiver
                    io.to(receiverId).emit('liveLocationStopped', {
                        messageId,
                        senderId: userId
                    });
                    
                    socket.emit('liveLocationStopped', {
                        messageId,
                        senderId: userId
                    });
                }
            } catch (error) {
                console.error('Stop live location error:', error);
            }
        });

        // Request partner's location
        socket.on('requestLocation', (data) => {
            const { to } = data;
            console.log(`📍 ${socket.user.name} requesting location from ${to}`);
            
            io.to(to).emit('locationRequested', {
                from: userId,
                name: socket.user.name
            });
        });

        // ===========================================
        // Listen Together Events (Spotify Sync)
        // ===========================================

        // Start listen-together session
        socket.on('listenTogether:start', (data) => {
            const { partnerId, track } = data;
            console.log(`🎵 ${socket.user.name} starting listen together session`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:invite', {
                    from: userId,
                    fromName: socket.user.name,
                    track
                });
            }
        });

        // Accept listen-together invitation
        socket.on('listenTogether:accept', (data) => {
            const { partnerId, track } = data;
            console.log(`🎵 ${socket.user.name} accepted listen together`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:accepted', {
                    from: userId,
                    fromName: socket.user.name,
                    track
                });
            }
            
            // Also emit to self
            socket.emit('listenTogether:started', { track });
        });

        // Decline listen-together invitation
        socket.on('listenTogether:decline', (data) => {
            const { partnerId } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:declined', {
                    from: userId,
                    fromName: socket.user.name
                });
            }
        });

        // Sync playback state
        socket.on('listenTogether:sync', (data) => {
            const { partnerId, isPlaying, position, track } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:syncState', {
                    from: userId,
                    isPlaying,
                    position,
                    track
                });
            }
        });

        // Play action
        socket.on('listenTogether:play', (data) => {
            const { partnerId, position } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:play', {
                    from: userId,
                    position
                });
            }
        });

        // Pause action
        socket.on('listenTogether:pause', (data) => {
            const { partnerId, position } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:pause', {
                    from: userId,
                    position
                });
            }
        });

        // Seek action
        socket.on('listenTogether:seek', (data) => {
            const { partnerId, position } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:seek', {
                    from: userId,
                    position
                });
            }
        });

        // End listen-together session
        socket.on('listenTogether:end', (data) => {
            const { partnerId } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('listenTogether:ended', {
                    from: userId,
                    fromName: socket.user.name
                });
            }
        });

        // ===========================================
        // Mood Sync Events
        // ===========================================

        // Mood updated - notify partner in real-time
        socket.on('moodUpdated', (data) => {
            const { partnerId, mood, status, emoji } = data;
            console.log(`💭 ${socket.user.name} updated mood to ${mood}`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('partnerMoodChanged', {
                    from: userId,
                    fromName: socket.user.name,
                    mood,
                    status,
                    emoji,
                    updatedAt: new Date()
                });
            }
        });

        // Request partner's current mood
        socket.on('requestPartnerMood', (data) => {
            const { partnerId } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('moodRequested', {
                    from: userId,
                    fromName: socket.user.name
                });
            }
        });

        // ===========================================
        // Couple Theme Events
        // ===========================================

        // Theme updated - notify partner in real-time
        socket.on('themeUpdated', (data) => {
            const { partnerId, theme } = data;
            console.log(`🎨 ${socket.user.name} updated couple theme`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('partnerThemeChanged', {
                    from: userId,
                    fromName: socket.user.name,
                    theme,
                    updatedAt: new Date()
                });
            }
        });

        // Theme reset - notify partner
        socket.on('themeReset', (data) => {
            const { partnerId } = data;
            console.log(`🎨 ${socket.user.name} reset couple theme to default`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('partnerThemeReset', {
                    from: userId,
                    fromName: socket.user.name,
                    updatedAt: new Date()
                });
            }
        });

        // ===========================================
        // Couple Games Events
        // ===========================================

        // Invite partner to play a game
        socket.on('game:invite', (data) => {
            const { partnerId, gameType, gameName } = data;
            console.log(`🎮 ${socket.user.name} inviting partner to play ${gameType}`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:invite', {
                    from: userId,
                    fromName: socket.user.name,
                    gameType,
                    gameName
                });
            } else {
                socket.emit('game:partnerOffline');
            }
        });

        // Accept game invite
        socket.on('game:accept', (data) => {
            const { partnerId, gameId, gameType } = data;
            console.log(`🎮 ${socket.user.name} accepted game invite`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:accepted', {
                    from: userId,
                    fromName: socket.user.name,
                    gameId,
                    gameType
                });
            }
        });

        // Decline game invite
        socket.on('game:decline', (data) => {
            const { partnerId } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:declined', {
                    from: userId,
                    fromName: socket.user.name
                });
            }
        });

        // Game move (for turn-based games like Tic Tac Toe, Connect Four)
        socket.on('game:move', (data) => {
            const { partnerId, gameId, move, gameState } = data;
            console.log(`🎮 ${socket.user.name} made a move in game ${gameId}`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:move', {
                    from: userId,
                    fromName: socket.user.name,
                    gameId,
                    move,
                    gameState
                });
            }
        });

        // Submit choice (for simultaneous games like Rock Paper Scissors)
        socket.on('game:choice', (data) => {
            const { partnerId, gameId, choice, roundId } = data;
            console.log(`🎮 ${socket.user.name} submitted choice for round ${roundId}`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:partnerChose', {
                    from: userId,
                    gameId,
                    roundId,
                    hasChosen: true
                });
            }
        });

        // Reveal choices (when both have chosen)
        socket.on('game:reveal', (data) => {
            const { partnerId, gameId, myChoice, result } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:reveal', {
                    from: userId,
                    gameId,
                    partnerChoice: myChoice,
                    result
                });
            }
        });

        // Send emoji clue (for Emoji Charades)
        socket.on('game:emoji', (data) => {
            const { partnerId, gameId, emojis, category } = data;
            console.log(`🎮 ${socket.user.name} sent emoji clue`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:emoji', {
                    from: userId,
                    fromName: socket.user.name,
                    gameId,
                    emojis,
                    category
                });
            }
        });

        // Guess answer (for word games)
        socket.on('game:guess', (data) => {
            const { partnerId, gameId, guess, isCorrect } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:guess', {
                    from: userId,
                    fromName: socket.user.name,
                    gameId,
                    guess,
                    isCorrect
                });
            }
        });

        // Word chain - send word
        socket.on('game:word', (data) => {
            const { partnerId, gameId, word } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:word', {
                    from: userId,
                    fromName: socket.user.name,
                    gameId,
                    word
                });
            }
        });

        // Game over
        socket.on('game:over', (data) => {
            const { partnerId, gameId, winner, finalScore } = data;
            console.log(`🎮 Game ${gameId} ended. Winner: ${winner || 'Draw'}`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:over', {
                    from: userId,
                    gameId,
                    winner,
                    finalScore
                });
            }
        });

        // Leave/quit game
        socket.on('game:leave', (data) => {
            const { partnerId, gameId } = data;
            console.log(`🎮 ${socket.user.name} left game ${gameId}`);
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:partnerLeft', {
                    from: userId,
                    fromName: socket.user.name,
                    gameId
                });
            }
        });

        // Request rematch
        socket.on('game:rematch', (data) => {
            const { partnerId, gameType } = data;
            
            const partnerSocketId = onlineUsers.get(partnerId);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit('game:rematch', {
                    from: userId,
                    fromName: socket.user.name,
                    gameType
                });
            }
        });

        // ===========================================
        // Disconnect Event
        // ===========================================

        socket.on('disconnect', async () => {
            console.log(`🔴 User disconnected: ${socket.user.name}`);

            // Update lastSeen timestamp in database
            const lastSeen = new Date();
            try {
                await User.findByIdAndUpdate(userId, { lastSeen });
            } catch (err) {
                console.error('Error updating lastSeen:', err);
            }

            // Remove from online users
            onlineUsers.delete(userId);

            // Broadcast offline status with lastSeen timestamp
            io.emit('userOffline', { userId, lastSeen });
        });
    });
};

// ===========================================
// Helper Functions
// ===========================================

// Get socket ID for a user
const getSocketId = (userId) => {
    return onlineUsers.get(userId);
};

// Check if user is online
const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
};

module.exports = {
    initializeSocket,
    getSocketId,
    isUserOnline
};
