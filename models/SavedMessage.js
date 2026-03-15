// ===========================================
// SavedMessage Model
// Defines schema for saved chat memories
// ===========================================

const mongoose = require('mongoose');

// Define the SavedMessage schema
const savedMessageSchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },

    // Who saved this message
    savedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Reference to the original message
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        required: true
    },

    // Denormalized message data (in case original is deleted)
    messageData: {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        senderName: String,
        message: String,
        type: {
            type: String,
            enum: ['text', 'image', 'file', 'voice', 'gif', 'video', 'videoNote', 'location'],
            default: 'text'
        },
        filePath: String,
        fileName: String,
        fileSize: Number,
        gifUrl: String,
        duration: Number,
        originalDate: Date
    },

    // Optional note/caption added when saving
    note: {
        type: String,
        trim: true,
        maxlength: [500, 'Note cannot exceed 500 characters'],
        default: ''
    },

    // Category for organizing memories
    category: {
        type: String,
        enum: ['moments', 'photos', 'videos', 'files', 'quotes', 'other'],
        default: 'moments'
    },

    // Is this memory pinned/featured
    isPinned: {
        type: Boolean,
        default: false
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ===========================================
// Indexes
// ===========================================

// Index for efficient querying by couple
savedMessageSchema.index({ coupleId: 1, createdAt: -1 });
savedMessageSchema.index({ coupleId: 1, category: 1 });
savedMessageSchema.index({ messageId: 1 }); // To check if already saved

// ===========================================
// Static Methods
// ===========================================

// Check if a message is already saved by this couple
savedMessageSchema.statics.isMessageSaved = async function(coupleId, messageId) {
    const existing = await this.findOne({ coupleId, messageId });
    return !!existing;
};

// Get saved messages for a couple with pagination
savedMessageSchema.statics.getSavedByCouple = async function(coupleId, options = {}) {
    const { page = 1, limit = 20, category } = options;
    const skip = (page - 1) * limit;
    
    const query = { coupleId };
    if (category && category !== 'all') {
        query.category = category;
    }
    
    const saved = await this.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('savedBy', 'name')
        .populate('messageData.senderId', 'name');
    
    const total = await this.countDocuments(query);
    
    return {
        saved,
        pagination: {
            current: page,
            total: Math.ceil(total / limit),
            count: total
        }
    };
};

// ===========================================
// Export the model
// ===========================================

module.exports = mongoose.model('SavedMessage', savedMessageSchema);
