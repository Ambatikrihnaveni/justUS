// ===========================================
// Socket.io Handler
// Manages real-time communication
// ===========================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Call = require('../models/Call');

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

                // Send to receiver if online
                if (isReceiverOnline) {
                    io.to(receiverId).emit('newMessage', newMessage);
                }

                // Also send back to sender for confirmation
                socket.emit('messageSent', newMessage);

                console.log(`📨 Message from ${socket.user.name} to ${receiverId} (${isReceiverOnline ? 'delivered' : 'pending'})`);
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
                socket.emit('callFailed', { reason: 'User is offline' });
                
                // Save as missed call
                try {
                    await Call.create({
                        callerId: userId,
                        receiverId: to,
                        type,
                        status: 'missed',
                        duration: 0
                    });
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
        // Disconnect Event
        // ===========================================

        socket.on('disconnect', () => {
            console.log(`🔴 User disconnected: ${socket.user.name}`);

            // Remove from online users
            onlineUsers.delete(userId);

            // Broadcast offline status
            io.emit('userOffline', { userId });
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
