// ===========================================
// Couple Theme Model
// Defines the schema for couple theme customization
// ===========================================

const mongoose = require('mongoose');

// Predefined wallpaper options
const WALLPAPER_OPTIONS = [
    'none',
    'gradient-sunset',
    'gradient-ocean',
    'gradient-forest',
    'gradient-lavender',
    'gradient-rose',
    'pattern-hearts',
    'pattern-stars',
    'pattern-bubbles',
    'photo-beach',
    'photo-mountains',
    'photo-city',
    'custom'
];

// Predefined color themes
const COLOR_THEMES = [
    'pink',      // Default pink/purple gradient
    'blue',      // Ocean blue theme
    'green',     // Forest green theme
    'purple',    // Deep purple theme
    'orange',    // Sunset orange theme
    'red',       // Romantic red theme
    'teal',      // Fresh teal theme
    'gold',      // Elegant gold theme
    'custom'     // Custom colors
];

// Theme styles
const THEME_STYLES = [
    'modern',     // Clean, rounded corners
    'classic',    // Traditional look
    'minimal',    // Simple, less decoration
    'playful',    // Fun, animated
    'elegant',    // Sophisticated
    'cozy'        // Warm and comfortable
];

// Define the CoupleTheme schema
const coupleThemeSchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true,
        unique: true
    },

    // Wallpaper settings
    wallpaper: {
        type: {
            type: String,
            enum: WALLPAPER_OPTIONS,
            default: 'none'
        },
        customUrl: {
            type: String,
            default: null
        },
        opacity: {
            type: Number,
            min: 0,
            max: 100,
            default: 30
        },
        blur: {
            type: Number,
            min: 0,
            max: 20,
            default: 0
        }
    },

    // Color theme
    colorTheme: {
        type: String,
        enum: COLOR_THEMES,
        default: 'pink'
    },

    // Custom colors (used when colorTheme is 'custom')
    customColors: {
        primary: {
            type: String,
            default: '#ff6b9d'
        },
        secondary: {
            type: String,
            default: '#c44ce0'
        },
        accent: {
            type: String,
            default: '#8b5cf6'
        },
        myBubble: {
            type: String,
            default: '#ff6b9d'
        },
        partnerBubble: {
            type: String,
            default: '#e0e0e0'
        },
        background: {
            type: String,
            default: '#ffffff'
        },
        text: {
            type: String,
            default: '#333333'
        }
    },

    // Theme style
    themeStyle: {
        type: String,
        enum: THEME_STYLES,
        default: 'modern'
    },

    // Chat bubble style
    bubbleStyle: {
        borderRadius: {
            type: Number,
            min: 0,
            max: 24,
            default: 18
        },
        showTail: {
            type: Boolean,
            default: true
        },
        shadow: {
            type: Boolean,
            default: true
        }
    },

    // Font settings
    fontSettings: {
        size: {
            type: String,
            enum: ['small', 'medium', 'large'],
            default: 'medium'
        },
        family: {
            type: String,
            enum: ['default', 'rounded', 'elegant', 'playful'],
            default: 'default'
        }
    },

    // Additional effects
    effects: {
        animations: {
            type: Boolean,
            default: true
        },
        messageEffects: {
            type: Boolean,
            default: true
        },
        soundEffects: {
            type: Boolean,
            default: true
        }
    },

    // Who last updated the theme
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Static method to get default theme
coupleThemeSchema.statics.getDefaultTheme = function(coupleId) {
    return {
        coupleId,
        wallpaper: {
            type: 'none',
            customUrl: null,
            opacity: 30,
            blur: 0
        },
        colorTheme: 'pink',
        customColors: {
            primary: '#ff6b9d',
            secondary: '#c44ce0',
            accent: '#8b5cf6',
            myBubble: '#ff6b9d',
            partnerBubble: '#e0e0e0',
            background: '#ffffff',
            text: '#333333'
        },
        themeStyle: 'modern',
        bubbleStyle: {
            borderRadius: 18,
            showTail: true,
            shadow: true
        },
        fontSettings: {
            size: 'medium',
            family: 'default'
        },
        effects: {
            animations: true,
            messageEffects: true,
            soundEffects: true
        }
    };
};

// Export constants for use in controllers
coupleThemeSchema.statics.WALLPAPER_OPTIONS = WALLPAPER_OPTIONS;
coupleThemeSchema.statics.COLOR_THEMES = COLOR_THEMES;
coupleThemeSchema.statics.THEME_STYLES = THEME_STYLES;

// Create and export the model
const CoupleTheme = mongoose.model('CoupleTheme', coupleThemeSchema);

module.exports = CoupleTheme;
