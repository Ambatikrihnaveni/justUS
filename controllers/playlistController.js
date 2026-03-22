// ===========================================
// Playlist Controller
// Handles shared couple playlist operations
// Security: All operations filtered by couple_id
// ===========================================

const PlaylistSong = require('../models/PlaylistSong');
const User = require('../models/User');

// ===========================================
// Add song to playlist
// POST /api/playlist
// ===========================================

const addSong = async (req, res) => {
    try {
        const { title, artist, link, note } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!title || !artist) {
            return res.status(400).json({
                success: false,
                message: 'Song title and artist are required'
            });
        }

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to add songs'
            });
        }

        // Create the song
        const song = new PlaylistSong({
            coupleId: user.coupleId,
            addedBy: userId,
            title: title.trim(),
            artist: artist.trim(),
            link: link?.trim() || '',
            note: note?.trim() || ''
        });

        await song.save();
        await song.populate('addedBy', 'name avatar');

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(user.coupleId.toString()).emit('playlistSongAdded', song);
        }

        res.status(201).json({
            success: true,
            message: 'Song added to playlist',
            data: song
        });

    } catch (error) {
        console.error('Add song error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add song',
            error: error.message
        });
    }
};

// ===========================================
// Get playlist
// GET /api/playlist
// ===========================================

const getPlaylist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 50 } = req.query;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to view playlist'
            });
        }

        const result = await PlaylistSong.getPlaylist(user.coupleId, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Get playlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get playlist',
            error: error.message
        });
    }
};

// ===========================================
// Update song
// PUT /api/playlist/:id
// ===========================================

const updateSong = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, artist, link, note, isFavorite } = req.body;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find song and verify ownership
        const song = await PlaylistSong.findOne({
            _id: id,
            coupleId: user.coupleId
        });

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        // Update fields
        if (title !== undefined) song.title = title.trim();
        if (artist !== undefined) song.artist = artist.trim();
        if (link !== undefined) song.link = link.trim();
        if (note !== undefined) song.note = note.trim();
        if (isFavorite !== undefined) song.isFavorite = isFavorite;

        await song.save();
        await song.populate('addedBy', 'name avatar');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(user.coupleId.toString()).emit('playlistSongUpdated', song);
        }

        res.json({
            success: true,
            message: 'Song updated',
            data: song
        });

    } catch (error) {
        console.error('Update song error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update song',
            error: error.message
        });
    }
};

// ===========================================
// Toggle favorite
// POST /api/playlist/:id/favorite
// ===========================================

const toggleFavorite = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find song and verify ownership
        const song = await PlaylistSong.findOne({
            _id: id,
            coupleId: user.coupleId
        });

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        // Toggle favorite
        song.isFavorite = !song.isFavorite;
        await song.save();
        await song.populate('addedBy', 'name avatar');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(user.coupleId.toString()).emit('playlistSongUpdated', song);
        }

        res.json({
            success: true,
            message: song.isFavorite ? 'Added to favorites' : 'Removed from favorites',
            data: song
        });

    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle favorite',
            error: error.message
        });
    }
};

// ===========================================
// Delete song
// DELETE /api/playlist/:id
// ===========================================

const deleteSong = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        // Get user's couple ID
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find and delete
        const song = await PlaylistSong.findOneAndDelete({
            _id: id,
            coupleId: user.coupleId
        });

        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(user.coupleId.toString()).emit('playlistSongDeleted', { songId: id });
        }

        res.json({
            success: true,
            message: 'Song removed from playlist'
        });

    } catch (error) {
        console.error('Delete song error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete song',
            error: error.message
        });
    }
};

module.exports = {
    addSong,
    getPlaylist,
    updateSong,
    toggleFavorite,
    deleteSong
};
