// ===========================================
// Saved Message Routes
// Routes for saved chat memories
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    saveMessage,
    getSavedMessages,
    updateSavedMessage,
    deleteSavedMessage,
    checkIfSaved,
    togglePin
} = require('../controllers/savedMessageController');

// All routes require authentication
router.use(protect);

// Save a message to memories
router.post('/', saveMessage);

// Get all saved messages for couple
router.get('/', getSavedMessages);

// Check if a message is saved
router.get('/check/:messageId', checkIfSaved);

// Update saved message (note, category, pin)
router.put('/:id', updateSavedMessage);

// Toggle pin status
router.post('/:id/pin', togglePin);

// Delete saved message
router.delete('/:id', deleteSavedMessage);

module.exports = router;
