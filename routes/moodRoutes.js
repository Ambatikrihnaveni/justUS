// ===========================================
// Mood Routes
// Routes for mood sync feature
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getCurrentMood,
    setMood,
    getMoodHistory,
    getMoodStats
} = require('../controllers/moodController');

// ===========================================
// Route Definitions
// ===========================================

// GET /api/mood - Get current mood (both partners)
router.get('/', protect, getCurrentMood);

// PUT /api/mood - Set current mood
router.put('/', protect, setMood);

// GET /api/mood/history - Get mood history
router.get('/history', protect, getMoodHistory);

// GET /api/mood/stats - Get mood statistics
router.get('/stats', protect, getMoodStats);

module.exports = router;
