// ===========================================
// LoveStory Model
// Stores generated and edited love stories
// ===========================================

const mongoose = require('mongoose');

const loveStorySchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true,
        unique: true
    },

    // The generated story content
    generatedStory: {
        type: String,
        default: ''
    },

    // User-edited version of the story
    editedStory: {
        type: String,
        default: ''
    },

    // Whether the user has customized the story
    isCustomized: {
        type: Boolean,
        default: false
    },

    // Story title
    title: {
        type: String,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
        default: 'Our Love Story'
    },

    // Story chapters/sections
    chapters: [{
        title: {
            type: String,
            required: true
        },
        content: {
            type: String,
            required: true
        },
        eventDate: {
            type: Date
        },
        icon: {
            type: String,
            default: '💕'
        },
        order: {
            type: Number,
            default: 0
        }
    }],

    // Story statistics
    stats: {
        totalDaysTogether: {
            type: Number,
            default: 0
        },
        totalMessages: {
            type: Number,
            default: 0
        },
        totalEvents: {
            type: Number,
            default: 0
        },
        totalPhotos: {
            type: Number,
            default: 0
        },
        favoriteWords: [{
            word: String,
            count: Number
        }]
    },

    // Story style/theme
    style: {
        type: String,
        enum: ['romantic', 'playful', 'poetic', 'classic', 'modern'],
        default: 'romantic'
    },

    // Last generated timestamp
    lastGenerated: {
        type: Date,
        default: null
    },

    // Last edited timestamp
    lastEdited: {
        type: Date,
        default: null
    },

    // Created timestamp
    createdAt: {
        type: Date,
        default: Date.now
    },

    // Updated timestamp
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save middleware
loveStorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Create and export the model
const LoveStory = mongoose.model('LoveStory', loveStorySchema);

module.exports = LoveStory;
