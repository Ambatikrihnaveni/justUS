// ===========================================
// Love Story Routes
// Handles love story generation and management
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    generateStory,
    getStory,
    updateStory,
    addChapter,
    deleteChapter,
    getStyles
} = require('../controllers/loveStoryController');

// All routes require authentication
router.use(protect);

// ===========================================
// Routes
// ===========================================

// Get available story styles
router.get('/styles', getStyles);

// Get current love story
router.get('/', getStory);

// Generate/regenerate love story
router.post('/generate', generateStory);

// Update love story
router.put('/', updateStory);

// Add custom chapter
router.post('/chapters', addChapter);

// Delete chapter
router.delete('/chapters/:chapterIndex', deleteChapter);

module.exports = router;
