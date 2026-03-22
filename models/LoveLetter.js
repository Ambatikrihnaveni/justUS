// ===========================================
// Love Letter Model
// Secret letters that unlock on a specific date
// ===========================================

const mongoose = require('mongoose');

const loveLetterSchema = new mongoose.Schema({
    // The couple this letter belongs to
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true,
        index: true
    },
    
    // Who sent this letter
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Who receives this letter
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // The secret message content
    content: {
        type: String,
        required: true,
        maxlength: 5000
    },
    
    // Title for the letter
    title: {
        type: String,
        required: true,
        maxlength: 100,
        default: 'A Secret Letter'
    },
    
    // Date when the letter will unlock
    unlockDate: {
        type: Date,
        required: true
    },
    
    // Occasion type for the letter
    occasion: {
        type: String,
        enum: [
            'birthday',
            'anniversary', 
            'valentine',
            'christmas',
            'new_year',
            'just_because',
            'surprise',
            'apology',
            'thank_you',
            'custom'
        ],
        default: 'custom'
    },
    
    // Custom occasion label
    customOccasion: {
        type: String,
        maxlength: 50
    },
    
    // Has the recipient opened it after unlock?
    isOpened: {
        type: Boolean,
        default: false
    },
    
    // When was it first opened
    openedAt: {
        type: Date
    },
    
    // Emoji/theme for the envelope
    theme: {
        type: String,
        enum: ['heart', 'star', 'flower', 'cake', 'gift', 'moon', 'sun', 'sparkle'],
        default: 'heart'
    }
}, {
    timestamps: true
});

// Index for efficient querying
loveLetterSchema.index({ coupleId: 1, unlockDate: 1 });
loveLetterSchema.index({ recipientId: 1, unlockDate: 1 });

// Virtual to check if letter is unlocked
loveLetterSchema.virtual('isUnlocked').get(function() {
    return new Date() >= this.unlockDate;
});

// Method to get countdown until unlock
loveLetterSchema.methods.getCountdown = function() {
    const now = new Date();
    const unlock = new Date(this.unlockDate);
    
    if (now >= unlock) {
        return { unlocked: true, days: 0, hours: 0, minutes: 0 };
    }
    
    const diff = unlock - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { unlocked: false, days, hours, minutes };
};

// Ensure JSON includes virtuals
loveLetterSchema.set('toJSON', { virtuals: true });
loveLetterSchema.set('toObject', { virtuals: true });

const LoveLetter = mongoose.model('LoveLetter', loveLetterSchema);

module.exports = LoveLetter;
