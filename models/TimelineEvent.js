// ===========================================
// TimelineEvent Model
// Stores relationship timeline events/milestones
// ===========================================

const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },

    // Who added this event
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Event title
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },

    // Event description
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        default: ''
    },

    // Date of the event
    eventDate: {
        type: Date,
        required: [true, 'Event date is required']
    },

    // Event type/category
    eventType: {
        type: String,
        enum: [
            'first_meet',
            'first_date',
            'first_kiss',
            'first_trip',
            'moved_in',
            'engagement',
            'wedding',
            'anniversary',
            'milestone',
            'travel',
            'achievement',
            'special_moment',
            'custom'
        ],
        default: 'custom'
    },

    // Optional location
    location: {
        name: {
            type: String,
            trim: true,
            maxlength: [200, 'Location name cannot exceed 200 characters'],
            default: ''
        },
        // Optional coordinates for map display
        latitude: {
            type: Number,
            default: null
        },
        longitude: {
            type: Number,
            default: null
        }
    },

    // Optional image/photo for the event
    image: {
        type: String,
        default: ''
    },

    // Icon/emoji for the event (auto-set based on type or custom)
    icon: {
        type: String,
        default: '💕'
    },

    // Color theme for the event card
    color: {
        type: String,
        default: '#ff6b9d'
    },

    // Is this a major milestone (featured/highlighted)
    isMilestone: {
        type: Boolean,
        default: false
    },

    // Last edited by
    lastEditedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ===========================================
// Indexes
// ===========================================

timelineEventSchema.index({ coupleId: 1, eventDate: 1 });
timelineEventSchema.index({ coupleId: 1, eventType: 1 });

// ===========================================
// Pre-save middleware
// ===========================================

timelineEventSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Auto-set icon based on event type if not custom set
    if (this.isNew || this.isModified('eventType')) {
        const typeIcons = {
            'first_meet': '👋',
            'first_date': '🌹',
            'first_kiss': '💋',
            'first_trip': '✈️',
            'moved_in': '🏠',
            'engagement': '💍',
            'wedding': '💒',
            'anniversary': '🎂',
            'milestone': '🏆',
            'travel': '🗺️',
            'achievement': '⭐',
            'special_moment': '✨',
            'custom': '💕'
        };
        
        if (!this.icon || this.icon === '💕') {
            this.icon = typeIcons[this.eventType] || '💕';
        }
    }
    
    // Auto-set milestone flag for important events
    if (this.isNew) {
        const milestoneTypes = ['first_meet', 'first_date', 'engagement', 'wedding', 'anniversary'];
        if (milestoneTypes.includes(this.eventType)) {
            this.isMilestone = true;
        }
    }
    
    next();
});

// ===========================================
// Static Methods
// ===========================================

// Get all events for a couple in chronological order
timelineEventSchema.statics.getTimelineForCouple = async function(coupleId, options = {}) {
    const { limit = 50, skip = 0, eventType = null } = options;
    
    const query = { coupleId };
    if (eventType) {
        query.eventType = eventType;
    }
    
    const events = await this.find(query)
        .sort({ eventDate: 1 }) // Oldest first (chronological)
        .skip(skip)
        .limit(limit)
        .populate('addedBy', 'name avatar')
        .populate('lastEditedBy', 'name');
    
    return events;
};

// Get timeline statistics
timelineEventSchema.statics.getTimelineStats = async function(coupleId) {
    const totalEvents = await this.countDocuments({ coupleId });
    const milestones = await this.countDocuments({ coupleId, isMilestone: true });
    
    const firstEvent = await this.findOne({ coupleId })
        .sort({ eventDate: 1 })
        .select('eventDate title');
    
    const lastEvent = await this.findOne({ coupleId })
        .sort({ eventDate: -1 })
        .select('eventDate title');
    
    // Calculate relationship duration
    let duration = null;
    if (firstEvent) {
        const start = new Date(firstEvent.eventDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        const days = diffDays % 30;
        
        duration = { years, months, days, totalDays: diffDays };
    }
    
    return {
        totalEvents,
        milestones,
        firstEvent,
        lastEvent,
        duration
    };
};

const TimelineEvent = mongoose.model('TimelineEvent', timelineEventSchema);

module.exports = TimelineEvent;
