// ===========================================
// Saved Message Controller
// Handles saved chat memories operations
// Security: All operations filtered by couple_id
// ===========================================

const SavedMessage = require('../models/SavedMessage');
const Message = require('../models/Message');
const User = require('../models/User');

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

module.exports = {
    saveMessage,
    getSavedMessages,
    updateSavedMessage,
    deleteSavedMessage,
    checkIfSaved,
    togglePin
};
