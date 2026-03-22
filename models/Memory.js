// ===========================================
// Memory Model
// Defines the schema for couple memories/photos
// ===========================================

const mongoose = require('mongoose');

// Define the Memory schema
const memorySchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },

    // Who uploaded this memory
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Memory title
    title: {
        type: String,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
        default: ''
    },

    // Memory description
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        default: ''
    },

    // Image URL
    image: {
        type: String,
        required: [true, 'Memory image is required']
    },

    // Date of the memory
    memoryDate: {
        type: Date,
        default: Date.now
    },

    // Location where memory was made
    location: {
        type: String,
        trim: true,
        default: ''
    },

    // Location coordinates for map display
    coordinates: {
        latitude: {
            type: Number,
            default: null
        },
        longitude: {
            type: Number,
            default: null
        }
    },

    // Memory type/category
    category: {
        type: String,
        enum: ['travel', 'date', 'milestone', 'everyday', 'celebration', 'other'],
        default: 'other'
    },

    // Is this memory featured/pinned
    isFeatured: {
        type: Boolean,
        default: false
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ===========================================
// Pre-save Middleware
// ===========================================

memorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// ===========================================
// Indexes
// ===========================================

// Index for efficient querying by couple
memorySchema.index({ coupleId: 1, memoryDate: -1 });
memorySchema.index({ coupleId: 1, category: 1 });
// Index for memories with coordinates
memorySchema.index({ coupleId: 1, 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

// ===========================================
// Static Methods
// ===========================================

// Get memories for a couple with pagination
memorySchema.statics.getMemoriesByCouple = async function(coupleId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const memories = await this.find({ coupleId })
        .sort({ memoryDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate('uploadedBy', 'name avatar');
    
    const total = await this.countDocuments({ coupleId });
    
    return {
        memories,
        pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
        }
    };
};

// Get featured memories for a couple
memorySchema.statics.getFeaturedMemories = async function(coupleId) {
    return this.find({ coupleId, isFeatured: true })
        .sort({ memoryDate: -1 })
        .limit(10)
        .populate('uploadedBy', 'name avatar');
};

// Create and export the model
const Memory = mongoose.model('Memory', memorySchema);

module.exports = Memory;
