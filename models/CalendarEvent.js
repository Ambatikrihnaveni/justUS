// ===========================================
// Calendar Event Model
// Shared couple calendar events
// ===========================================

const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
    // The couple this event belongs to
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true,
        index: true
    },
    
    // Who created this event
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Event title
    title: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    },
    
    // Event description
    description: {
        type: String,
        maxlength: 500,
        trim: true
    },
    
    // Event date and time
    eventDate: {
        type: Date,
        required: true,
        index: true
    },
    
    // End date (for multi-day events like trips)
    endDate: {
        type: Date
    },
    
    // Is this an all-day event?
    allDay: {
        type: Boolean,
        default: true
    },
    
    // Event type/category
    eventType: {
        type: String,
        enum: [
            'anniversary',
            'birthday',
            'first_date',
            'first_kiss',
            'first_trip',
            'trip',
            'date_night',
            'meeting',
            'reminder',
            'holiday',
            'milestone',
            'other'
        ],
        default: 'other'
    },
    
    // Color for the event (hex or preset)
    color: {
        type: String,
        enum: ['pink', 'red', 'purple', 'blue', 'green', 'orange', 'yellow'],
        default: 'pink'
    },
    
    // Emoji icon for the event
    icon: {
        type: String,
        default: '📅'
    },
    
    // Is this a recurring event?
    isRecurring: {
        type: Boolean,
        default: false
    },
    
    // Recurrence pattern
    recurrence: {
        type: String,
        enum: ['none', 'yearly', 'monthly', 'weekly'],
        default: 'none'
    },
    
    // Reminder settings
    reminder: {
        enabled: {
            type: Boolean,
            default: true
        },
        daysBefore: {
            type: Number,
            default: 1,
            min: 0,
            max: 30
        }
    },
    
    // Has reminder been sent?
    reminderSent: {
        type: Boolean,
        default: false
    },
    
    // Location (optional)
    location: {
        type: String,
        maxlength: 200
    },
    
    // Notes
    notes: {
        type: String,
        maxlength: 1000
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
calendarEventSchema.index({ coupleId: 1, eventDate: 1 });
calendarEventSchema.index({ coupleId: 1, eventType: 1 });

// Virtual to check if event is upcoming (within next 7 days)
calendarEventSchema.virtual('isUpcoming').get(function() {
    const now = new Date();
    const eventDate = new Date(this.eventDate);
    const diffDays = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
});

// Virtual to get days until event
calendarEventSchema.virtual('daysUntil').get(function() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const eventDate = new Date(this.eventDate);
    eventDate.setHours(0, 0, 0, 0);
    return Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
});

// Ensure JSON includes virtuals
calendarEventSchema.set('toJSON', { virtuals: true });
calendarEventSchema.set('toObject', { virtuals: true });

// Static method to get upcoming events
calendarEventSchema.statics.getUpcoming = async function(coupleId, days = 30) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return this.find({
        coupleId,
        eventDate: { $gte: now, $lte: futureDate }
    })
    .populate('createdBy', 'name profilePicture')
    .sort({ eventDate: 1 });
};

// Static method to get events for a specific month
calendarEventSchema.statics.getByMonth = async function(coupleId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    return this.find({
        coupleId,
        eventDate: { $gte: startDate, $lte: endDate }
    })
    .populate('createdBy', 'name profilePicture')
    .sort({ eventDate: 1 });
};

// Event type configurations
calendarEventSchema.statics.getEventTypes = function() {
    return [
        { value: 'anniversary', label: 'Anniversary', icon: '💕', color: 'pink' },
        { value: 'birthday', label: 'Birthday', icon: '🎂', color: 'purple' },
        { value: 'first_date', label: 'First Date', icon: '💝', color: 'red' },
        { value: 'first_kiss', label: 'First Kiss', icon: '💋', color: 'red' },
        { value: 'first_trip', label: 'First Trip', icon: '✈️', color: 'blue' },
        { value: 'trip', label: 'Trip/Vacation', icon: '🏖️', color: 'blue' },
        { value: 'date_night', label: 'Date Night', icon: '🍷', color: 'purple' },
        { value: 'meeting', label: 'Meeting', icon: '📍', color: 'green' },
        { value: 'reminder', label: 'Reminder', icon: '⏰', color: 'orange' },
        { value: 'holiday', label: 'Holiday', icon: '🎉', color: 'yellow' },
        { value: 'milestone', label: 'Milestone', icon: '🏆', color: 'orange' },
        { value: 'other', label: 'Other', icon: '📅', color: 'pink' }
    ];
};

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);

module.exports = CalendarEvent;
