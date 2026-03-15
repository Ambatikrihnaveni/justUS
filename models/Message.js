// ===========================================
// Message Model
// Defines the schema for chat messages
// ===========================================

const mongoose = require('mongoose');

// Define the Message schema
const messageSchema = new mongoose.Schema({
    // Who sent the message
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Sender is required']
    },

    // Who receives the message
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Receiver is required']
    },

    // The actual message content
    message: {
        type: String,
        default: '',
        trim: true,
        maxlength: [5000, 'Message cannot exceed 5000 characters']
    },

    // Type of message: text, image, file, voice, gif, video, videoNote, location, liveLocation
    type: {
        type: String,
        enum: ['text', 'image', 'file', 'voice', 'gif', 'video', 'videoNote', 'location', 'liveLocation'],
        default: 'text'
    },

    // For media messages, store the file path
    filePath: {
        type: String,
        default: ''
    },

    // Original file name (for file uploads)
    fileName: {
        type: String,
        default: ''
    },

    // File size in bytes
    fileSize: {
        type: Number,
        default: 0
    },

    // Duration for voice/video messages (in seconds)
    duration: {
        type: Number,
        default: 0
    },

    // GIF URL or sticker ID
    gifUrl: {
        type: String,
        default: ''
    },

    // Sound URL for GIF stickers
    soundUrl: {
        type: String,
        default: ''
    },

    // Location data (for location and liveLocation types)
    location: {
        latitude: {
            type: Number,
            default: null
        },
        longitude: {
            type: Number,
            default: null
        },
        accuracy: {
            type: Number,
            default: null
        },
        address: {
            type: String,
            default: ''
        }
    },

    // Live location specific fields
    liveLocationDuration: {
        type: Number, // Duration in minutes (15, 60, 480)
        default: 0
    },
    liveLocationExpiresAt: {
        type: Date,
        default: null
    },
    liveLocationActive: {
        type: Boolean,
        default: false
    },

    // Has the receiver seen this message?
    seen: {
        type: Boolean,
        default: false
    },

    // Has the message been delivered to receiver's device?
    delivered: {
        type: Boolean,
        default: false
    },

    // When was the message delivered
    deliveredAt: {
        type: Date,
        default: null
    },

    // When was the message seen
    seenAt: {
        type: Date,
        default: null
    },

    // Is message edited?
    isEdited: {
        type: Boolean,
        default: false
    },

    // When was the message edited
    editedAt: {
        type: Date,
        default: null
    },

    // Is message unsent (completely removed)?
    isUnsent: {
        type: Boolean,
        default: false
    },

    // Is message deleted for both (shows "message was deleted")?
    isDeleted: {
        type: Boolean,
        default: false
    },

    // Deleted for specific users (delete for me)
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // When the message was sent
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ===========================================
// Indexes
// For faster queries when fetching chat history
// ===========================================

// Index for finding messages between two users
messageSchema.index({ senderId: 1, receiverId: 1 });

// Index for sorting by creation time
messageSchema.index({ createdAt: -1 });

// Create and export the model
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
