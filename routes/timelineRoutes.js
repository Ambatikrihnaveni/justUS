// ===========================================
// Timeline Routes
// Routes for relationship timeline feature
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    getTimeline,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventTypes
} = require('../controllers/timelineController');

// All routes require authentication
router.use(protect);

// ===========================================
// Routes
// ===========================================

// Get event types (for dropdown) - must be before /:eventId
router.get('/types', getEventTypes);

// Get all timeline events
router.get('/', getTimeline);

// Get single event
router.get('/:eventId', getEvent);

// Create new event
router.post('/', createEvent);

// Update event
router.put('/:eventId', updateEvent);

// Delete event
router.delete('/:eventId', deleteEvent);

module.exports = router;
