// ===========================================
// Couple Model
// Defines the schema for couple relationships
// ===========================================

const mongoose = require('mongoose');
const crypto = require('crypto');

// Define the Couple schema
const coupleSchema = new mongoose.Schema({
    // Partner 1 (creator of the couple)
    partner1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Partner 2 (joins via invite code)
    partner2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // Unique invite code for partner to join
    inviteCode: {
        type: String,
        unique: true,
        required: true
    },

    // Who created the couple space
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Maximum users allowed (always 2 for couples)
    maxUsers: {
        type: Number,
        default: 2,
        max: 2
    },

    // Couple's shared name
    coupleName: {
        type: String,
        trim: true,
        maxlength: [100, 'Couple name cannot exceed 100 characters'],
        default: ''
    },

    // Relationship status
    relationshipStatus: {
        type: String,
        enum: ['dating', 'engaged', 'married', 'complicated', 'long-distance', 'other'],
        default: 'dating'
    },

    // Important Dates
    firstMeetDate: {
        type: Date,
        default: null
    },

    firstDateLocation: {
        type: String,
        trim: true,
        default: ''
    },

    proposalDate: {
        type: Date,
        default: null
    },

    engagementDate: {
        type: Date,
        default: null
    },

    weddingDate: {
        type: Date,
        default: null
    },

    anniversaryDate: {
        type: Date,
        default: null
    },

    nextMeetingDate: {
        type: Date,
        default: null
    },

    // Distance between partners (in km)
    distanceBetweenPartners: {
        type: Number,
        default: 0
    },

    // Love Story
    loveStory: {
        type: String,
        trim: true,
        maxlength: [5000, 'Love story cannot exceed 5000 characters'],
        default: ''
    },

    // Couple Photo
    couplePhoto: {
        type: String,
        default: ''
    },

    // Relationship Questions
    relationshipQuestions: {
        whoSaidILoveYouFirst: {
            type: String,
            enum: ['partner1', 'partner2', 'both', 'none'],
            default: 'none'
        },
        whoProposedFirst: {
            type: String,
            enum: ['partner1', 'partner2', 'none'],
            default: 'none'
        },
        firstTripTogether: {
            type: String,
            trim: true,
            default: ''
        },
        firstGiftReceived: {
            type: String,
            trim: true,
            default: ''
        },
        longestCallDuration: {
            type: String,
            trim: true,
            default: ''
        }
    },

    // Current moods
    partner1Mood: {
        type: String,
        enum: ['happy', 'sad', 'missing_you', 'in_love', 'tired', 'excited', 'neutral'],
        default: 'neutral'
    },

    partner2Mood: {
        type: String,
        enum: ['happy', 'sad', 'missing_you', 'in_love', 'tired', 'excited', 'neutral'],
        default: 'neutral'
    },

    // Whether the couple space is complete (both partners joined)
    isComplete: {
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

coupleSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// ===========================================
// Static Methods
// ===========================================

// Generate unique invite code
coupleSchema.statics.generateInviteCode = function() {
    // Generate a 8-character alphanumeric code
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Find couple by invite code
coupleSchema.statics.findByInviteCode = async function(code) {
    return this.findOne({ inviteCode: code.toUpperCase() })
        .populate('partner1', 'name email avatar')
        .populate('partner2', 'name email avatar');
};

// ===========================================
// Instance Methods
// ===========================================

// Check if user is part of this couple
coupleSchema.methods.isPartner = function(userId) {
    const userIdStr = userId.toString();
    const partner1Id = this.partner1?._id?.toString() || this.partner1?.toString();
    const partner2Id = this.partner2?._id?.toString() || this.partner2?.toString();
    return userIdStr === partner1Id || userIdStr === partner2Id;
};

// Get partner (returns the other partner's ID)
coupleSchema.methods.getPartner = function(userId) {
    const userIdStr = userId.toString();
    const partner1Id = this.partner1?._id?.toString() || this.partner1?.toString();
    if (userIdStr === partner1Id) {
        return this.partner2;
    }
    return this.partner1;
};

// Calculate relationship duration
coupleSchema.methods.getRelationshipDuration = function() {
    if (!this.firstMeetDate) return null;
    const now = new Date();
    const start = new Date(this.firstMeetDate);
    const diff = now - start;
    
    const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor((diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    const days = Math.floor((diff % (30.44 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
    
    return { years, months, days };
};

// Create and export the model
const Couple = mongoose.model('Couple', coupleSchema);

module.exports = Couple;
