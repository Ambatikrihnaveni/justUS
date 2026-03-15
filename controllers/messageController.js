// ===========================================
// Message Controller
// Handles chat message operations
// Security: All operations filtered by couple_id
// ===========================================

const Message = require('../models/Message');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Helper: Verify users are in same couple
// ===========================================

const verifyCouple = async (userId1, userId2) => {
    const user1 = await User.findById(userId1);
    const user2 = await User.findById(userId2);
    
    if (!user1 || !user2) return false;
    if (!user1.coupleId || !user2.coupleId) return false;
    
    // Both users must have the same couple_id
    return user1.coupleId.toString() === user2.coupleId.toString();
};

// ===========================================
// Get Chat History
// GET /api/messages/:userId
// Gets all messages between current user and partner
// Security: Only allows communication within couple
// ===========================================

const getChatHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        // Validate that the other user exists
        const otherUser = await User.findById(userId);
        if (!otherUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Security: Verify both users are in the same couple
        const isValidCouple = await verifyCouple(currentUserId, userId);
        if (!isValidCouple) {
            return res.status(403).json({
                success: false,
                message: 'You can only view messages with your partner'
            });
        }

        // Find all messages between these two users
        // Either sent by current user to other, or received from other
        const messages = await Message.find({
            $or: [
                { senderId: currentUserId, receiverId: userId },
                { senderId: userId, receiverId: currentUserId }
            ]
        })
        .sort({ createdAt: 1 }) // Sort by oldest first
        .populate('senderId', 'name avatar')
        .populate('receiverId', 'name avatar');

        // Mark messages as seen (messages received by current user)
        await Message.updateMany(
            { senderId: userId, receiverId: currentUserId, seen: false },
            { seen: true }
        );

        res.status(200).json({
            success: true,
            count: messages.length,
            messages
        });

    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching messages'
        });
    }
};

// ===========================================
// Send Message
// POST /api/messages
// Creates a new message to partner
// Security: Only allows messaging within couple
// ===========================================

const sendMessage = async (req, res) => {
    try {
        const { receiverId, message, type = 'text' } = req.body;
        const senderId = req.user._id;

        // Validate required fields
        if (!receiverId || !message) {
            return res.status(400).json({
                success: false,
                message: 'Receiver and message content are required'
            });
        }

        // Validate receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'Receiver not found'
            });
        }

        // Security: Verify both users are in the same couple
        const isValidCouple = await verifyCouple(senderId, receiverId);
        if (!isValidCouple) {
            return res.status(403).json({
                success: false,
                message: 'You can only send messages to your partner'
            });
        }

        // Create the message
        const newMessage = await Message.create({
            senderId,
            receiverId,
            message,
            type
        });

        // Populate sender and receiver info
        await newMessage.populate('senderId', 'name avatar');
        await newMessage.populate('receiverId', 'name avatar');

        // Emit socket event for real-time delivery
        // Get socket.io instance from app
        const io = req.app.get('io');
        if (io) {
            // Emit to receiver's room
            io.to(receiverId.toString()).emit('newMessage', newMessage);
        }

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending message'
        });
    }
};

// ===========================================
// Mark Messages as Seen
// PUT /api/messages/seen/:senderId
// Marks all messages from sender as seen
// ===========================================

const markAsSeen = async (req, res) => {
    try {
        const { senderId } = req.params;
        const receiverId = req.user._id;

        // Update all unseen messages from this sender
        const result = await Message.updateMany(
            { senderId, receiverId, seen: false },
            { seen: true }
        );

        // Emit socket event for read receipts
        const io = req.app.get('io');
        if (io) {
            io.to(senderId.toString()).emit('messagesSeen', {
                by: receiverId,
                count: result.modifiedCount
            });
        }

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} messages marked as seen`
        });

    } catch (error) {
        console.error('Mark as seen error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating message status'
        });
    }
};

// ===========================================
// Get Unread Count
// GET /api/messages/unread
// Gets count of unread messages
// ===========================================

const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user._id;

        // Count unread messages for current user
        const count = await Message.countDocuments({
            receiverId: userId,
            seen: false
        });

        res.status(200).json({
            success: true,
            unreadCount: count
        });

    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting unread count'
        });
    }
};

// ===========================================
// Edit Message
// PUT /api/messages/:messageId
// Edit a message (only sender can edit)
// ===========================================

const editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { message: newContent } = req.body;
        const userId = req.user._id;

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is the sender
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own messages'
            });
        }

        // Check if message is already unsent
        if (message.isUnsent) {
            return res.status(400).json({
                success: false,
                message: 'Cannot edit an unsent message'
            });
        }

        // Update the message
        message.message = newContent;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        // Populate and return
        await message.populate('senderId', 'name avatar');
        await message.populate('receiverId', 'name avatar');

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(message.receiverId._id.toString()).emit('messageEdited', message);
            io.to(message.senderId._id.toString()).emit('messageEdited', message);
        }

        res.status(200).json({
            success: true,
            message: 'Message edited successfully',
            data: message
        });

    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error editing message'
        });
    }
};

// ===========================================
// Unsend Message (Completely remove - no trace)
// DELETE /api/messages/:messageId/unsend
// Only sender can unsend, completely removes the message
// ===========================================

const unsendMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is the sender
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only unsend your own messages'
            });
        }

        const receiverId = message.receiverId.toString();

        // Completely delete the message from database
        await Message.findByIdAndDelete(messageId);

        // Emit socket event for real-time removal
        const io = req.app.get('io');
        if (io) {
            io.to(receiverId).emit('messageRemoved', { messageId });
            io.to(userId.toString()).emit('messageRemoved', { messageId });
        }

        res.status(200).json({
            success: true,
            message: 'Message unsent successfully',
            messageId
        });

    } catch (error) {
        console.error('Unsend message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error unsending message'
        });
    }
};

// ===========================================
// Delete for Both (Shows "message was deleted")
// DELETE /api/messages/:messageId/both
// Only sender can delete for both
// ===========================================

const deleteForBoth = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is the sender
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own messages for both'
            });
        }

        // Mark as deleted for both
        message.isDeleted = true;
        message.message = 'This message was deleted';
        await message.save();

        // Populate and return
        await message.populate('senderId', 'name avatar');
        await message.populate('receiverId', 'name avatar');

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(message.receiverId._id.toString()).emit('messageDeleted', message);
            io.to(message.senderId._id.toString()).emit('messageDeleted', message);
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted for both',
            data: message
        });

    } catch (error) {
        console.error('Delete for both error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message'
        });
    }
};

// ===========================================
// Delete Message (Delete for me only)
// DELETE /api/messages/:messageId
// Deletes message only for the current user
// ===========================================

const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is sender or receiver
        const isSender = message.senderId.toString() === userId.toString();
        const isReceiver = message.receiverId.toString() === userId.toString();

        if (!isSender && !isReceiver) {
            return res.status(403).json({
                success: false,
                message: 'You cannot delete this message'
            });
        }

        // Add user to deletedFor array
        if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
            await message.save();
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted for you',
            messageId
        });

    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message'
        });
    }
};

module.exports = {
    getChatHistory,
    sendMessage,
    markAsSeen,
    getUnreadCount,
    editMessage,
    unsendMessage,
    deleteForBoth,
    deleteMessage
};
