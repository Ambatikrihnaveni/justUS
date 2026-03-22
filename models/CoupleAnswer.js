// ===========================================
// CoupleAnswer Model
// Stores answers from couples for daily questions
// ===========================================

const mongoose = require('mongoose');

const coupleAnswerSchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },

    // Reference to the question
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DailyQuestion',
        required: true
    },

    // The date this question was answered (for tracking daily questions)
    questionDate: {
        type: Date,
        required: true
    },

    // Partner 1's answer
    partner1Answer: {
        text: {
            type: String,
            default: '',
            maxlength: [1000, 'Answer cannot exceed 1000 characters']
        },
        answeredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        answeredAt: {
            type: Date
        }
    },

    // Partner 2's answer
    partner2Answer: {
        text: {
            type: String,
            default: '',
            maxlength: [1000, 'Answer cannot exceed 1000 characters']
        },
        answeredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        answeredAt: {
            type: Date
        }
    },

    // Both partners have answered
    isComplete: {
        type: Boolean,
        default: false
    },

    // When both answers were revealed
    revealedAt: {
        type: Date
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

// Compound index to ensure one answer record per couple per question per date
coupleAnswerSchema.index({ coupleId: 1, questionId: 1, questionDate: 1 }, { unique: true });
coupleAnswerSchema.index({ coupleId: 1, questionDate: -1 });

// Pre-save middleware to update timestamps and check completion
coupleAnswerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Check if both partners have answered
    if (this.partner1Answer.text && this.partner2Answer.text) {
        if (!this.isComplete) {
            this.isComplete = true;
            this.revealedAt = Date.now();
        }
    }
    
    next();
});

// Static method to get or create today's answer record for a couple
coupleAnswerSchema.statics.getOrCreateTodaysAnswer = async function(coupleId, questionId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let answer = await this.findOne({
        coupleId,
        questionId,
        questionDate: today
    }).populate('questionId');
    
    if (!answer) {
        answer = await this.create({
            coupleId,
            questionId,
            questionDate: today
        });
        await answer.populate('questionId');
    }
    
    return answer;
};

// Static method to check if user has already answered today
coupleAnswerSchema.statics.hasUserAnswered = async function(coupleId, questionId, userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const answer = await this.findOne({
        coupleId,
        questionId,
        questionDate: today,
        $or: [
            { 'partner1Answer.answeredBy': userId },
            { 'partner2Answer.answeredBy': userId }
        ]
    });
    
    return !!answer;
};

// Instance method to submit an answer
coupleAnswerSchema.methods.submitAnswer = async function(userId, answerText) {
    // Check if user already answered
    if (this.partner1Answer.answeredBy?.toString() === userId.toString() ||
        this.partner2Answer.answeredBy?.toString() === userId.toString()) {
        throw new Error('You have already answered this question');
    }
    
    // Determine which slot to use
    if (!this.partner1Answer.answeredBy) {
        this.partner1Answer = {
            text: answerText,
            answeredBy: userId,
            answeredAt: new Date()
        };
    } else if (!this.partner2Answer.answeredBy) {
        this.partner2Answer = {
            text: answerText,
            answeredBy: userId,
            answeredAt: new Date()
        };
    } else {
        throw new Error('Both partners have already answered');
    }
    
    await this.save();
    return this;
};

// Instance method to get answer status for a user
coupleAnswerSchema.methods.getStatusForUser = function(userId) {
    const userIdStr = userId.toString();
    
    const userAnswered = 
        this.partner1Answer.answeredBy?.toString() === userIdStr ||
        this.partner2Answer.answeredBy?.toString() === userIdStr;
    
    const partnerAnswered = 
        (this.partner1Answer.answeredBy && this.partner1Answer.answeredBy.toString() !== userIdStr) ||
        (this.partner2Answer.answeredBy && this.partner2Answer.answeredBy.toString() !== userIdStr);
    
    // Get user's own answer
    let userAnswer = null;
    let partnerAnswer = null;
    
    if (this.partner1Answer.answeredBy?.toString() === userIdStr) {
        userAnswer = this.partner1Answer;
        partnerAnswer = this.partner2Answer.text ? this.partner2Answer : null;
    } else if (this.partner2Answer.answeredBy?.toString() === userIdStr) {
        userAnswer = this.partner2Answer;
        partnerAnswer = this.partner1Answer.text ? this.partner1Answer : null;
    }
    
    return {
        userAnswered,
        partnerAnswered,
        bothAnswered: this.isComplete,
        userAnswer: userAnswered ? userAnswer : null,
        partnerAnswer: this.isComplete ? partnerAnswer : null, // Only show if both answered
        revealedAt: this.revealedAt
    };
};

const CoupleAnswer = mongoose.model('CoupleAnswer', coupleAnswerSchema);

module.exports = CoupleAnswer;
