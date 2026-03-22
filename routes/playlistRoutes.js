// ===========================================
// Playlist Routes
// Routes for shared couple playlist
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    addSong,
    getPlaylist,
    updateSong,
    toggleFavorite,
    deleteSong
} = require('../controllers/playlistController');

// All routes require authentication
router.use(protect);

// Get playlist
router.get('/', getPlaylist);

// Add song to playlist
router.post('/', addSong);

// Update song
router.put('/:id', updateSong);

// Toggle favorite status
router.post('/:id/favorite', toggleFavorite);

// Delete song
router.delete('/:id', deleteSong);

module.exports = router;
