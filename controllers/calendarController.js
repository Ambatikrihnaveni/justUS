// ===========================================
// Calendar Controller
// Handles shared couple calendar operations
// ===========================================

const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Helper: Verify user belongs to couple
// ===========================================

const getUserCouple = async (userId) => {
    const user = await User.findById(userId);
    if (!user || !user.coupleId) {
        return null;
    }
    
    const couple = await Couple.findById(user.coupleId);
    if (!couple || !couple.isComplete) {
        return null;
    }
    
    return { user, couple };
};

// ===========================================
// Get Events for a Month
// GET /api/calendar/month/:year/:month
// ===========================================

const getMonthEvents = async (req, res) => {
    try {
        const userId = req.user._id;
        const { year, month } = req.params;
        
        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple to use the calendar'
            });
        }

        const events = await CalendarEvent.getByMonth(
            data.couple._id,
            parseInt(year),
            parseInt(month)
        );

        res.json({
            success: true,
            events,
            month: parseInt(month),
            year: parseInt(year)
        });

    } catch (error) {
        console.error('Get month events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar events'
        });
    }
};

// ===========================================
// Get Upcoming Events
// GET /api/calendar/upcoming
// ===========================================

const getUpcomingEvents = async (req, res) => {
    try {
        const userId = req.user._id;
        const { days = 30 } = req.query;
        
        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple to use the calendar'
            });
        }

        const events = await CalendarEvent.getUpcoming(
            data.couple._id,
            parseInt(days)
        );

        // Group by upcoming status
        const today = [];
        const thisWeek = [];
        const later = [];

        events.forEach(event => {
            const daysUntil = event.daysUntil;
            if (daysUntil === 0) {
                today.push(event);
            } else if (daysUntil <= 7) {
                thisWeek.push(event);
            } else {
                later.push(event);
            }
        });

        res.json({
            success: true,
            events,
            grouped: { today, thisWeek, later }
        });

    } catch (error) {
        console.error('Get upcoming events error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch upcoming events'
        });
    }
};

// ===========================================
// Get Single Event
// GET /api/calendar/:eventId
// ===========================================

const getEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { eventId } = req.params;
        
        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple'
            });
        }

        const event = await CalendarEvent.findById(eventId)
            .populate('createdBy', 'name profilePicture');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Verify event belongs to user's couple
        if (event.coupleId.toString() !== data.couple._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this event'
            });
        }

        res.json({
            success: true,
            event
        });

    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch event'
        });
    }
};

// ===========================================
// Create Event
// POST /api/calendar
// ===========================================

const createEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            title,
            description,
            eventDate,
            endDate,
            allDay,
            eventType,
            color,
            icon,
            isRecurring,
            recurrence,
            reminder,
            location,
            notes
        } = req.body;

        // Validate required fields
        if (!title || !eventDate) {
            return res.status(400).json({
                success: false,
                message: 'Title and event date are required'
            });
        }

        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple to create events'
            });
        }

        // Create the event
        const event = await CalendarEvent.create({
            coupleId: data.couple._id,
            createdBy: userId,
            title,
            description,
            eventDate: new Date(eventDate),
            endDate: endDate ? new Date(endDate) : undefined,
            allDay: allDay !== undefined ? allDay : true,
            eventType: eventType || 'other',
            color: color || 'pink',
            icon: icon || '📅',
            isRecurring: isRecurring || false,
            recurrence: recurrence || 'none',
            reminder: reminder || { enabled: true, daysBefore: 1 },
            location,
            notes
        });

        // Populate creator info
        await event.populate('createdBy', 'name profilePicture');

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            event
        });

    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create event'
        });
    }
};

// ===========================================
// Update Event
// PUT /api/calendar/:eventId
// ===========================================

const updateEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { eventId } = req.params;
        const updates = req.body;

        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple'
            });
        }

        const event = await CalendarEvent.findById(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Verify event belongs to user's couple
        if (event.coupleId.toString() !== data.couple._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this event'
            });
        }

        // Update allowed fields
        const allowedUpdates = [
            'title', 'description', 'eventDate', 'endDate', 'allDay',
            'eventType', 'color', 'icon', 'isRecurring', 'recurrence',
            'reminder', 'location', 'notes'
        ];

        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                if (field === 'eventDate' || field === 'endDate') {
                    event[field] = updates[field] ? new Date(updates[field]) : undefined;
                } else {
                    event[field] = updates[field];
                }
            }
        });

        await event.save();
        await event.populate('createdBy', 'name profilePicture');

        res.json({
            success: true,
            message: 'Event updated successfully',
            event
        });

    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update event'
        });
    }
};

// ===========================================
// Delete Event
// DELETE /api/calendar/:eventId
// ===========================================

const deleteEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { eventId } = req.params;

        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple'
            });
        }

        const event = await CalendarEvent.findById(eventId);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Verify event belongs to user's couple
        if (event.coupleId.toString() !== data.couple._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this event'
            });
        }

        await CalendarEvent.findByIdAndDelete(eventId);

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });

    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete event'
        });
    }
};

// ===========================================
// Get Event Types
// GET /api/calendar/types
// ===========================================

const getEventTypes = async (req, res) => {
    const types = CalendarEvent.getEventTypes();
    res.json({
        success: true,
        types
    });
};

module.exports = {
    getMonthEvents,
    getUpcomingEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventTypes
};
