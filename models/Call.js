// ===========================================
// Call Model
// Stores call history between users
// ===========================================

const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    // Who initiated the call
    callerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Caller is required']
    },

    // Who received the call
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Receiver is required']
    },

    // Type of call: audio or video
    type: {
        type: String,
        enum: ['audio', 'video'],
        required: [true, 'Call type is required']
    },

    // Call status
    status: {
        type: String,
        enum: ['missed', 'declined', 'answered', 'busy'],
        default: 'missed'
    },

    // Call duration in seconds (0 if not answered)
    duration: {
        type: Number,
        default: 0
    },

    // When the call started
    startedAt: {
        type: Date,
        default: Date.now
    },

    // When the call ended
    endedAt: {
        type: Date
    },

    // Has the user been notified about this missed call?
    notified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient queries
callSchema.index({ callerId: 1, receiverId: 1, createdAt: -1 });
callSchema.index({ receiverId: 1, createdAt: -1 });

// Create the model
const Call = mongoose.model('Call', callSchema);

module.exports = Call;
