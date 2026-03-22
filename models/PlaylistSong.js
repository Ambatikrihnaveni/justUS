// ===========================================
// PlaylistSong Model
// Stores songs in the couple's shared playlist
// ===========================================

const mongoose = require('mongoose');

const playlistSongSchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },

    // Who added this song
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Song title
    title: {
        type: String,
        required: [true, 'Song title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },

    // Artist name
    artist: {
        type: String,
        required: [true, 'Artist name is required'],
        trim: true,
        maxlength: [200, 'Artist name cannot exceed 200 characters']
    },

    // Link to the song (YouTube or Spotify)
    link: {
        type: String,
        trim: true,
        maxlength: [500, 'Link cannot exceed 500 characters'],
        default: ''
    },

    // Link type (auto-detected)
    linkType: {
        type: String,
        enum: ['youtube', 'spotify', 'other', 'none'],
        default: 'none'
    },

    // Optional note/memory about the song
    note: {
        type: String,
        trim: true,
        maxlength: [500, 'Note cannot exceed 500 characters'],
        default: ''
    },

    // Is this a favorite/special song
    isFavorite: {
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

playlistSongSchema.index({ coupleId: 1, createdAt: -1 });
playlistSongSchema.index({ coupleId: 1, isFavorite: -1 });

// ===========================================
// Pre-save middleware
// ===========================================

playlistSongSchema.pre('save', function(next) {
    // Auto-detect link type
    if (this.link) {
        const lowerLink = this.link.toLowerCase();
        if (lowerLink.includes('youtube.com') || lowerLink.includes('youtu.be')) {
            this.linkType = 'youtube';
        } else if (lowerLink.includes('spotify.com') || lowerLink.includes('open.spotify')) {
            this.linkType = 'spotify';
        } else if (this.link.trim() !== '') {
            this.linkType = 'other';
        } else {
            this.linkType = 'none';
        }
    } else {
        this.linkType = 'none';
    }
    next();
});

// ===========================================
// Static Methods
// ===========================================

// Get all songs for a couple
playlistSongSchema.statics.getPlaylist = async function(coupleId, options = {}) {
    const { page = 1, limit = 50, favoritesFirst = true } = options;
    const skip = (page - 1) * limit;

    const sortOrder = favoritesFirst 
        ? { isFavorite: -1, createdAt: -1 }
        : { createdAt: -1 };

    const songs = await this.find({ coupleId })
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .populate('addedBy', 'name avatar');

    const total = await this.countDocuments({ coupleId });

    return {
        songs,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
};

const PlaylistSong = mongoose.model('PlaylistSong', playlistSongSchema);

module.exports = PlaylistSong;
