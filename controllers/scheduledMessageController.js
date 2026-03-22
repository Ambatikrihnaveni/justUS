// ===========================================
// Scheduled Message Controller
// Handles scheduled message operations
// ===========================================

const ScheduledMessage = require('../models/ScheduledMessage');
const Message = require('../models/Message');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Helper: Get user's couple info
// ===========================================

const getUserCouple = async (userId) => {
    const user = await User.findById(userId);
    if (!user || !user.coupleId) return null;
    
    const couple = await Couple.findById(user.coupleId);
    if (!couple || !couple.isComplete) return null;
    
    const partnerId = couple.partner1.toString() === userId.toString()
        ? couple.partner2
        : couple.partner1;
    
    return { user, couple, partnerId };
};

// ===========================================
// Get Scheduled Messages
// GET /api/scheduled-messages
// ===========================================

const getScheduledMessages = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple'
            });
        }

        const messages = await ScheduledMessage.find({
            coupleId: data.couple._id,
            senderId: userId,
            status: 'pending',
            scheduledFor: { $gt: new Date() }
        })
        .populate('recipientId', 'name profilePicture')
        .sort({ scheduledFor: 1 });

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.error('Get scheduled messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scheduled messages'
        });
    }
};

// ===========================================
// Get Single Scheduled Message
// GET /api/scheduled-messages/:messageId
// ===========================================

const getScheduledMessage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { messageId } = req.params;
        
        const message = await ScheduledMessage.findById(messageId)
            .populate('recipientId', 'name profilePicture');

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled message not found'
            });
        }

        // Verify ownership
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only view your own scheduled messages'
            });
        }

        res.json({
            success: true,
            message
        });

    } catch (error) {
        console.error('Get scheduled message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scheduled message'
        });
    }
};

// ===========================================
// Create Scheduled Message
// POST /api/scheduled-messages
// ===========================================

const createScheduledMessage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { content, scheduledFor, messageType, mediaUrl, occasion, note, isSurprise, revealEffect } = req.body;

        // Validate required fields
        if (!content || !scheduledFor) {
            return res.status(400).json({
                success: false,
                message: 'Content and scheduled time are required'
            });
        }

        // Validate scheduled time is in the future
        const scheduledDate = new Date(scheduledFor);
        const now = new Date();
        const minTime = new Date(now.getTime() + 60000); // At least 1 minute in future
        
        if (scheduledDate <= minTime) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be at least 1 minute in the future'
            });
        }

        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple to schedule messages'
            });
        }

        // Create scheduled message
        const scheduledMessage = await ScheduledMessage.create({
            coupleId: data.couple._id,
            senderId: userId,
            recipientId: data.partnerId,
            content,
            messageType: messageType || 'text',
            mediaUrl,
            scheduledFor: scheduledDate,
            occasion: occasion || 'custom',
            note,
            isSurprise: isSurprise || false,
            revealEffect: revealEffect || 'none'
        });

        await scheduledMessage.populate('recipientId', 'name profilePicture');

        res.status(201).json({
            success: true,
            message: 'Message scheduled successfully',
            scheduledMessage
        });

    } catch (error) {
        console.error('Create scheduled message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to schedule message'
        });
    }
};

// ===========================================
// Update Scheduled Message
// PUT /api/scheduled-messages/:messageId
// ===========================================

const updateScheduledMessage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { messageId } = req.params;
        const { content, scheduledFor, occasion, note, isSurprise, revealEffect } = req.body;

        const message = await ScheduledMessage.findById(messageId);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled message not found'
            });
        }

        // Verify ownership
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own scheduled messages'
            });
        }

        // Can only edit pending messages
        if (message.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Can only edit pending messages'
            });
        }

        // Update fields
        if (content) message.content = content;
        if (scheduledFor) {
            const scheduledDate = new Date(scheduledFor);
            if (scheduledDate <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Scheduled time must be in the future'
                });
            }
            message.scheduledFor = scheduledDate;
        }
        if (occasion) message.occasion = occasion;
        if (note !== undefined) message.note = note;
        if (isSurprise !== undefined) message.isSurprise = isSurprise;
        if (revealEffect) message.revealEffect = revealEffect;

        await message.save();
        await message.populate('recipientId', 'name profilePicture');

        res.json({
            success: true,
            message: 'Scheduled message updated',
            scheduledMessage: message
        });

    } catch (error) {
        console.error('Update scheduled message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update scheduled message'
        });
    }
};

// ===========================================
// Cancel Scheduled Message
// DELETE /api/scheduled-messages/:messageId
// ===========================================

const cancelScheduledMessage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { messageId } = req.params;

        const message = await ScheduledMessage.findById(messageId);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled message not found'
            });
        }

        // Verify ownership
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only cancel your own scheduled messages'
            });
        }

        // Can only cancel pending messages
        if (message.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Can only cancel pending messages'
            });
        }

        message.status = 'cancelled';
        await message.save();

        res.json({
            success: true,
            message: 'Scheduled message cancelled'
        });

    } catch (error) {
        console.error('Cancel scheduled message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel scheduled message'
        });
    }
};

// ===========================================
// Get Occasion Types
// GET /api/scheduled-messages/occasions
// ===========================================

const getOccasions = async (req, res) => {
    const occasions = [
        { value: 'good_morning', label: 'Good Morning ☀️', icon: '☀️' },
        { value: 'good_night', label: 'Good Night 🌙', icon: '🌙' },
        { value: 'birthday', label: 'Birthday 🎂', icon: '🎂' },
        { value: 'anniversary', label: 'Anniversary 💕', icon: '💕' },
        { value: 'surprise', label: 'Surprise! 🎁', icon: '🎁' },
        { value: 'reminder', label: 'Reminder ⏰', icon: '⏰' },
        { value: 'custom', label: 'Custom', icon: '💬' }
    ];

    res.json({
        success: true,
        occasions
    });
};

// ===========================================
// Process Due Messages (called by scheduler)
// Internal function - not an API endpoint
// ===========================================

const processDueMessages = async (io) => {
    try {
        const dueMessages = await ScheduledMessage.getDueMessages();
        
        for (const scheduled of dueMessages) {
            try {
                // Create the actual message
                const message = await Message.create({
                    senderId: scheduled.senderId,
                    receiverId: scheduled.recipientId,
                    content: scheduled.content,
                    messageType: scheduled.messageType,
                    mediaUrl: scheduled.mediaUrl
                });

                // Update scheduled message status
                scheduled.status = 'sent';
                scheduled.sentAt = new Date();
                scheduled.messageId = message._id;
                await scheduled.save();

                // Emit socket event to recipient
                if (io) {
                    io.to(`user_${scheduled.recipientId}`).emit('new_message', {
                        message,
                        scheduled: true
                    });
                }

                console.log(`✅ Scheduled message ${scheduled._id} sent successfully`);
            } catch (err) {
                console.error(`❌ Failed to send scheduled message ${scheduled._id}:`, err);
                scheduled.status = 'failed';
                scheduled.errorMessage = err.message;
                await scheduled.save();
            }
        }

        return dueMessages.length;
    } catch (error) {
        console.error('Process due messages error:', error);
        return 0;
    }
};

module.exports = {
    getScheduledMessages,
    getScheduledMessage,
    createScheduledMessage,
    updateScheduledMessage,
    cancelScheduledMessage,
    getOccasions,
    processDueMessages
};
