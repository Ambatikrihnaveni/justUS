// ===========================================
// Timeline Controller
// Handles relationship timeline operations
// ===========================================

const TimelineEvent = require('../models/TimelineEvent');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Helper: Verify user belongs to couple
// ===========================================

const verifyCoupleMember = async (userId, coupleId) => {
    const couple = await Couple.findById(coupleId);
    if (!couple) return false;
    
    return couple.partner1.toString() === userId.toString() ||
           couple.partner2?.toString() === userId.toString();
};

// ===========================================
// Get Timeline Events
// GET /api/timeline
// ===========================================

const getTimeline = async (req, res) => {
    try {
        const userId = req.user._id;
        const { eventType, limit = 50, page = 1 } = req.query;

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to view the timeline'
            });
        }

        const coupleId = user.coupleId;
        const skip = (page - 1) * limit;

        // Get events
        const events = await TimelineEvent.getTimelineForCouple(coupleId, {
            limit: parseInt(limit),
            skip,
            eventType: eventType || null
        });

        // Get total count
        const query = { coupleId };
        if (eventType) query.eventType = eventType;
        const total = await TimelineEvent.countDocuments(query);

        // Get stats
        const stats = await TimelineEvent.getTimelineStats(coupleId);

        res.status(200).json({
            success: true,
            data: {
                events,
                stats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get timeline error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching timeline'
        });
    }
};

// ===========================================
// Get Single Event
// GET /api/timeline/:eventId
// ===========================================

const getEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { eventId } = req.params;

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        const event = await TimelineEvent.findById(eventId)
            .populate('addedBy', 'name avatar')
            .populate('lastEditedBy', 'name');

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Verify ownership
        if (event.coupleId.toString() !== user.coupleId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only view your own timeline events'
            });
        }

        res.status(200).json({
            success: true,
            data: event
        });

    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching event'
        });
    }
};

// ===========================================
// Create Timeline Event
// POST /api/timeline
// ===========================================

const createEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { title, description, eventDate, eventType, location, image, icon, color, isMilestone } = req.body;

        // Validate required fields
        if (!title || !eventDate) {
            return res.status(400).json({
                success: false,
                message: 'Title and date are required'
            });
        }

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to add timeline events'
            });
        }

        // Verify couple is complete
        const couple = await Couple.findById(user.coupleId);
        if (!couple || !couple.isComplete) {
            return res.status(400).json({
                success: false,
                message: 'Your partner needs to join first'
            });
        }

        // Create event
        const event = await TimelineEvent.create({
            coupleId: user.coupleId,
            addedBy: userId,
            title: title.trim(),
            description: description?.trim() || '',
            eventDate: new Date(eventDate),
            eventType: eventType || 'custom',
            location: location || {},
            image: image || '',
            icon: icon || undefined,
            color: color || '#ff6b9d',
            isMilestone: isMilestone || false
        });

        // Populate for response
        await event.populate('addedBy', 'name avatar');

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            const partnerId = couple.partner1.toString() === userId.toString()
                ? couple.partner2
                : couple.partner1;
            
            io.to(partnerId.toString()).emit('timelineEventAdded', {
                event,
                addedByName: req.user.name
            });
        }

        res.status(201).json({
            success: true,
            message: 'Event added to timeline',
            data: event
        });

    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating event'
        });
    }
};

// ===========================================
// Update Timeline Event
// PUT /api/timeline/:eventId
// ===========================================

const updateEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { eventId } = req.params;
        const { title, description, eventDate, eventType, location, image, icon, color, isMilestone } = req.body;

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find event
        const event = await TimelineEvent.findById(eventId);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Verify ownership
        if (event.coupleId.toString() !== user.coupleId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only edit your own timeline events'
            });
        }

        // Update fields
        if (title) event.title = title.trim();
        if (description !== undefined) event.description = description.trim();
        if (eventDate) event.eventDate = new Date(eventDate);
        if (eventType) event.eventType = eventType;
        if (location) event.location = location;
        if (image !== undefined) event.image = image;
        if (icon) event.icon = icon;
        if (color) event.color = color;
        if (isMilestone !== undefined) event.isMilestone = isMilestone;
        
        event.lastEditedBy = userId;

        await event.save();
        await event.populate('addedBy', 'name avatar');
        await event.populate('lastEditedBy', 'name');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const couple = await Couple.findById(user.coupleId);
            const partnerId = couple.partner1.toString() === userId.toString()
                ? couple.partner2
                : couple.partner1;
            
            io.to(partnerId.toString()).emit('timelineEventUpdated', {
                event,
                editedByName: req.user.name
            });
        }

        res.status(200).json({
            success: true,
            message: 'Event updated',
            data: event
        });

    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating event'
        });
    }
};

// ===========================================
// Delete Timeline Event
// DELETE /api/timeline/:eventId
// ===========================================

const deleteEvent = async (req, res) => {
    try {
        const userId = req.user._id;
        const { eventId } = req.params;

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple'
            });
        }

        // Find event
        const event = await TimelineEvent.findById(eventId);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        // Verify ownership
        if (event.coupleId.toString() !== user.coupleId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own timeline events'
            });
        }

        await TimelineEvent.findByIdAndDelete(eventId);

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const couple = await Couple.findById(user.coupleId);
            const partnerId = couple.partner1.toString() === userId.toString()
                ? couple.partner2
                : couple.partner1;
            
            io.to(partnerId.toString()).emit('timelineEventDeleted', {
                eventId,
                deletedByName: req.user.name
            });
        }

        res.status(200).json({
            success: true,
            message: 'Event deleted'
        });

    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting event'
        });
    }
};

// ===========================================
// Get Event Types (for dropdown)
// GET /api/timeline/types
// ===========================================

const getEventTypes = async (req, res) => {
    const types = [
        { value: 'first_meet', label: 'First Time We Met', icon: '👋', color: '#4caf50' },
        { value: 'first_date', label: 'First Date', icon: '🌹', color: '#e91e63' },
        { value: 'first_kiss', label: 'First Kiss', icon: '💋', color: '#ff4081' },
        { value: 'first_trip', label: 'First Trip Together', icon: '✈️', color: '#2196f3' },
        { value: 'moved_in', label: 'Moved In Together', icon: '🏠', color: '#ff9800' },
        { value: 'engagement', label: 'Engagement', icon: '💍', color: '#9c27b0' },
        { value: 'wedding', label: 'Wedding', icon: '💒', color: '#f44336' },
        { value: 'anniversary', label: 'Anniversary', icon: '🎂', color: '#e91e63' },
        { value: 'milestone', label: 'Milestone', icon: '🏆', color: '#ffc107' },
        { value: 'travel', label: 'Travel/Vacation', icon: '🗺️', color: '#00bcd4' },
        { value: 'achievement', label: 'Achievement', icon: '⭐', color: '#ffeb3b' },
        { value: 'special_moment', label: 'Special Moment', icon: '✨', color: '#673ab7' },
        { value: 'custom', label: 'Custom Event', icon: '💕', color: '#ff6b9d' }
    ];

    res.status(200).json({
        success: true,
        data: types
    });
};

module.exports = {
    getTimeline,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventTypes
};
