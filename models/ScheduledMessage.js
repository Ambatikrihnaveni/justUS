// ===========================================
// Scheduled Message Model
// Messages scheduled to be sent at a future time
// ===========================================

const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
    // The couple this message belongs to
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true,
        index: true
    },
    
    // Who is sending this message
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Who will receive this message
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Message content
    content: {
        type: String,
        required: true,
        maxlength: 2000
    },
    
    // Message type
    messageType: {
        type: String,
        enum: ['text', 'image', 'voice', 'gif'],
        default: 'text'
    },
    
    // Media URL if applicable
    mediaUrl: {
        type: String
    },
    
    // Scheduled send time
    scheduledFor: {
        type: Date,
        required: true,
        index: true
    },
    
    // Status of the scheduled message
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    
    // When was it actually sent
    sentAt: {
        type: Date
    },
    
    // Error message if failed
    errorMessage: {
        type: String
    },
    
    // Reference to the actual message after sending
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    
    // Optional: Occasion for the message
    occasion: {
        type: String,
        enum: [
            'good_morning',
            'good_night',
            'birthday',
            'anniversary',
            'surprise',
            'reminder',
            'custom'
        ],
        default: 'custom'
    },
    
    // Optional: Note about why this was scheduled
    note: {
        type: String,
        maxlength: 200
    },
    
    // Flag for surprise messages - won't show scheduled indicator to receiver
    isSurprise: {
        type: Boolean,
        default: false
    },
    
    // Special reveal effect for surprise messages
    revealEffect: {
        type: String,
        enum: ['none', 'confetti', 'hearts', 'fireworks', 'sparkle'],
        default: 'none'
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
scheduledMessageSchema.index({ scheduledFor: 1, status: 1 });
scheduledMessageSchema.index({ coupleId: 1, status: 1 });

// Virtual to check if message is due
scheduledMessageSchema.virtual('isDue').get(function() {
    return this.status === 'pending' && new Date() >= this.scheduledFor;
});

// Virtual to get time until send
scheduledMessageSchema.virtual('timeUntilSend').get(function() {
    if (this.status !== 'pending') return null;
    
    const now = new Date();
    const scheduled = new Date(this.scheduledFor);
    const diff = scheduled - now;
    
    if (diff <= 0) return { due: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { due: false, hours, minutes };
});

// Ensure JSON includes virtuals
scheduledMessageSchema.set('toJSON', { virtuals: true });
scheduledMessageSchema.set('toObject', { virtuals: true });

// Static: Get pending messages that are due
scheduledMessageSchema.statics.getDueMessages = async function() {
    const now = new Date();
    return this.find({
        status: 'pending',
        scheduledFor: { $lte: now }
    })
    .populate('senderId', 'name')
    .populate('recipientId', 'name');
};

// Static: Get user's scheduled messages
scheduledMessageSchema.statics.getUserScheduled = async function(coupleId, senderId) {
    return this.find({
        coupleId,
        senderId,
        status: 'pending',
        scheduledFor: { $gt: new Date() }
    })
    .sort({ scheduledFor: 1 });
};

const ScheduledMessage = mongoose.model('ScheduledMessage', scheduledMessageSchema);

module.exports = ScheduledMessage;
