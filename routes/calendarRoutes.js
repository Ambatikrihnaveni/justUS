// ===========================================
// Calendar Routes
// Routes for shared couple calendar
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    getMonthEvents,
    getUpcomingEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventTypes
} = require('../controllers/calendarController');

// All routes require authentication
router.use(protect);

// ===========================================
// Routes
// ===========================================

// Get event types (for dropdown) - must be before /:eventId
router.get('/types', getEventTypes);

// Get upcoming events
router.get('/upcoming', getUpcomingEvents);

// Get events for a specific month
router.get('/month/:year/:month', getMonthEvents);

// Get single event
router.get('/:eventId', getEvent);

// Create new event
router.post('/', createEvent);

// Update event
router.put('/:eventId', updateEvent);

// Delete event
router.delete('/:eventId', deleteEvent);

module.exports = router;
