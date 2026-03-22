// ===========================================
// Scheduled Message Routes
// Routes for message scheduling feature
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    getScheduledMessages,
    getScheduledMessage,
    createScheduledMessage,
    updateScheduledMessage,
    cancelScheduledMessage,
    getOccasions
} = require('../controllers/scheduledMessageController');

// All routes require authentication
router.use(protect);

// ===========================================
// Routes
// ===========================================

// Get occasion types (for dropdown) - must be before /:messageId
router.get('/occasions', getOccasions);

// Get all scheduled messages for current user
router.get('/', getScheduledMessages);

// Get single scheduled message
router.get('/:messageId', getScheduledMessage);

// Create new scheduled message
router.post('/', createScheduledMessage);

// Update scheduled message
router.put('/:messageId', updateScheduledMessage);

// Cancel scheduled message
router.delete('/:messageId', cancelScheduledMessage);

module.exports = router;
