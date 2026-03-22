// ===========================================
// Saved Message Controller
// Handles saved chat memories operations
// Security: All operations filtered by couple_id
// ===========================================

const SavedMessage = require('../models/SavedMessage');
const Message = require('../models/Message');
const User = require('../models/User');
const TimelineEvent = require('../models/TimelineEvent');

// ===========================================
// Save a message to memories
// POST /api/saved-messages
// ===========================================

const saveMessage = async (req, res) => {
    try {
        const { messageId, note, category } = req.body;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to save memories'
            });
        }

        const coupleId = user.coupleId;

        // Check if message exists
        const message = await Message.findById(messageId)
            .populate('senderId', 'name');
        
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if already saved
        const alreadySaved = await SavedMessage.isMessageSaved(coupleId, messageId);
        if (alreadySaved) {
            return res.status(400).json({
                success: false,
                message: 'This message is already saved to memories'
            });
        }

        // Determine category based on message type if not provided
        let finalCategory = category || 'moments';
        if (!category) {
            if (message.type === 'image') finalCategory = 'photos';
            else if (message.type === 'video' || message.type === 'videoNote') finalCategory = 'videos';
            else if (message.type === 'file') finalCategory = 'files';
            else if (message.type === 'text') finalCategory = 'quotes';
        }

        // Create saved message with denormalized data
        const savedMessage = new SavedMessage({
            coupleId,
            savedBy: userId,
            messageId,
            messageData: {
                senderId: message.senderId._id || message.senderId,
                senderName: message.senderId.name || 'Unknown',
                message: message.message,
                type: message.type,
                filePath: message.filePath,
                fileName: message.fileName,
                fileSize: message.fileSize,
                gifUrl: message.gifUrl,
                duration: message.duration,
                originalDate: message.createdAt
            },
            note: note || '',
            category: finalCategory
        });

        await savedMessage.save();

        // Populate for response
        await savedMessage.populate('savedBy', 'name');

        res.status(201).json({
            success: true,
            message: 'Message saved to memories',
            data: savedMessage
        });

    } catch (error) {
        console.error('Save message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save message',
            error: error.message
        });
    }
};

// ===========================================
// Get all saved messages for couple
// GET /api/saved-messages
// ===========================================

const getSavedMessages = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 20, category } = req.query;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to view memories'
            });
        }

        const result = await SavedMessage.getSavedByCouple(user.coupleId, {
            page: parseInt(page),
            limit: parseInt(limit),
            category
        });

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Get saved messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get saved messages',
            error: error.message
        });
    }
};

// ===========================================
// Update saved message (note, category, pin)
// PUT /api/saved-messages/:id
// ===========================================

const updateSavedMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { note, category, isPinned } = req.body;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find saved message and verify ownership
        const savedMessage = await SavedMessage.findOne({
            _id: id,
            coupleId: user.coupleId
        });

        if (!savedMessage) {
            return res.status(404).json({
                success: false,
                message: 'Saved message not found'
            });
        }

        // Update fields
        if (note !== undefined) savedMessage.note = note;
        if (category !== undefined) savedMessage.category = category;
        if (isPinned !== undefined) savedMessage.isPinned = isPinned;

        await savedMessage.save();
        await savedMessage.populate('savedBy', 'name');

        res.json({
            success: true,
            message: 'Memory updated',
            data: savedMessage
        });

    } catch (error) {
        console.error('Update saved message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update memory',
            error: error.message
        });
    }
};

// ===========================================
// Delete saved message
// DELETE /api/saved-messages/:id
// ===========================================

const deleteSavedMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find and delete
        const savedMessage = await SavedMessage.findOneAndDelete({
            _id: id,
            coupleId: user.coupleId
        });

        if (!savedMessage) {
            return res.status(404).json({
                success: false,
                message: 'Saved message not found'
            });
        }

        res.json({
            success: true,
            message: 'Memory removed'
        });

    } catch (error) {
        console.error('Delete saved message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete memory',
            error: error.message
        });
    }
};

// ===========================================
// Check if message is saved
// GET /api/saved-messages/check/:messageId
// ===========================================

const checkIfSaved = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.json({
                success: true,
                isSaved: false
            });
        }

        const isSaved = await SavedMessage.isMessageSaved(user.coupleId, messageId);

        res.json({
            success: true,
            isSaved
        });

    } catch (error) {
        console.error('Check saved error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check',
            error: error.message
        });
    }
};

// ===========================================
// Toggle pin status
// POST /api/saved-messages/:id/pin
// ===========================================

const togglePin = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find saved message and verify ownership
        const savedMessage = await SavedMessage.findOne({
            _id: id,
            coupleId: user.coupleId
        });

        if (!savedMessage) {
            return res.status(404).json({
                success: false,
                message: 'Saved message not found'
            });
        }

        // Toggle pin
        savedMessage.isPinned = !savedMessage.isPinned;
        await savedMessage.save();
        await savedMessage.populate('savedBy', 'name');

        res.json({
            success: true,
            message: savedMessage.isPinned ? 'Memory pinned' : 'Memory unpinned',
            data: savedMessage
        });

    } catch (error) {
        console.error('Toggle pin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle pin',
            error: error.message
        });
    }
};

// ===========================================
// Get "Today in Our Love" memories
// GET /api/saved-messages/today-in-our-love
// Returns memories from same date in previous years
// ===========================================

const getTodayInOurLove = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.json({
                success: true,
                memories: [],
                message: 'You must be in a couple to view memories'
            });
        }

        const coupleId = user.coupleId;
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // MongoDB uses 1-12
        const currentDay = today.getDate();
        const currentYear = today.getFullYear();

        // Find saved messages from same date in previous years
        const savedMessages = await SavedMessage.aggregate([
            {
                $match: {
                    coupleId: coupleId,
                    'messageData.originalDate': { $exists: true, $ne: null }
                }
            },
            {
                $addFields: {
                    memoryMonth: { $month: '$messageData.originalDate' },
                    memoryDay: { $dayOfMonth: '$messageData.originalDate' },
                    memoryYear: { $year: '$messageData.originalDate' }
                }
            },
            {
                $match: {
                    memoryMonth: currentMonth,
                    memoryDay: currentDay,
                    memoryYear: { $lt: currentYear }
                }
            },
            {
                $sort: { 'messageData.originalDate': -1 }
            },
            {
                $limit: 20
            }
        ]);

        // Find timeline events from same date in previous years
        const timelineEvents = await TimelineEvent.aggregate([
            {
                $match: {
                    coupleId: coupleId,
                    eventDate: { $exists: true, $ne: null }
                }
            },
            {
                $addFields: {
                    eventMonth: { $month: '$eventDate' },
                    eventDay: { $dayOfMonth: '$eventDate' },
                    eventYear: { $year: '$eventDate' }
                }
            },
            {
                $match: {
                    eventMonth: currentMonth,
                    eventDay: currentDay,
                    eventYear: { $lt: currentYear }
                }
            },
            {
                $sort: { eventDate: -1 }
            },
            {
                $limit: 20
            }
        ]);

        // Combine and format the results
        const memories = [];

        // Add saved messages
        for (const msg of savedMessages) {
            const yearsAgo = currentYear - msg.memoryYear;
            memories.push({
                _id: msg._id,
                type: 'message',
                title: msg.note || getMessagePreview(msg.messageData),
                description: msg.messageData.message || '',
                photo: msg.messageData.type === 'image' ? msg.messageData.filePath : 
                       msg.messageData.type === 'gif' ? msg.messageData.gifUrl : null,
                mediaType: msg.messageData.type,
                originalDate: msg.messageData.originalDate,
                yearsAgo,
                category: msg.category,
                senderName: msg.messageData.senderName,
                isPinned: msg.isPinned
            });
        }

        // Add timeline events
        for (const event of timelineEvents) {
            const yearsAgo = currentYear - event.eventYear;
            memories.push({
                _id: event._id,
                type: 'timeline',
                title: event.title,
                description: event.description || '',
                photo: event.image || null,
                mediaType: event.image ? 'image' : null,
                originalDate: event.eventDate,
                yearsAgo,
                eventType: event.eventType,
                icon: event.icon,
                location: event.location?.name || null,
                isMilestone: event.isMilestone
            });
        }

        // Sort by date (most recent first within same day)
        memories.sort((a, b) => new Date(b.originalDate) - new Date(a.originalDate));

        res.json({
            success: true,
            date: {
                month: currentMonth,
                day: currentDay,
                formatted: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
            },
            count: memories.length,
            memories
        });

    } catch (error) {
        console.error('Get Today in Our Love error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get memories',
            error: error.message
        });
    }
};

// Helper function to get preview text for a message
const getMessagePreview = (messageData) => {
    if (!messageData) return 'Memory';
    
    switch (messageData.type) {
        case 'text':
            return messageData.message?.substring(0, 50) || 'Text message';
        case 'image':
            return '📷 Photo';
        case 'video':
        case 'videoNote':
            return '🎬 Video';
        case 'voice':
            return '🎤 Voice message';
        case 'gif':
            return '🎭 GIF';
        case 'file':
            return `📄 ${messageData.fileName || 'File'}`;
        case 'location':
            return '📍 Location';
        default:
            return 'Memory';
    }
};

module.exports = {
    saveMessage,
    getSavedMessages,
    updateSavedMessage,
    deleteSavedMessage,
    checkIfSaved,
    togglePin,
    getTodayInOurLove
};
