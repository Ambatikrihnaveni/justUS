// ===========================================
// Love Letter Routes
// Routes for secret love letter feature
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    getLetters,
    getLetter,
    createLetter,
    deleteLetter,
    getOccasions
} = require('../controllers/loveLetterController');

// All routes require authentication
router.use(protect);

// ===========================================
// Routes
// ===========================================

// Get occasion types (for dropdown) - must be before /:letterId
router.get('/occasions', getOccasions);

// Get all letters (received and sent)
router.get('/', getLetters);

// Get single letter
router.get('/:letterId', getLetter);

// Create a new letter
router.post('/', createLetter);

// Delete a letter (only sender, only if not opened)
router.delete('/:letterId', deleteLetter);

module.exports = router;
