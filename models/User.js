// ===========================================
// User Model
// Defines the schema for user accounts
// ===========================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the User schema
const userSchema = new mongoose.Schema({
    // User's display name
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },

    // Nickname (what partner calls them)
    nickname: {
        type: String,
        trim: true,
        maxlength: [50, 'Nickname cannot exceed 50 characters'],
        default: ''
    },

    // User's email (unique identifier for login)
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email'
        ]
    },

    // Hashed password
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't return password in queries by default
    },

    // Profile picture URL
    avatar: {
        type: String,
        default: '' // Will use default avatar in frontend if empty
    },

    // Date of birth
    dateOfBirth: {
        type: Date,
        default: null
    },

    // Gender
    gender: {
        type: String,
        enum: ['male', 'female', 'non-binary', 'prefer-not-to-say', ''],
        default: ''
    },

    // Phone number
    phoneNumber: {
        type: String,
        trim: true,
        default: ''
    },

    // City / Country
    city: {
        type: String,
        trim: true,
        maxlength: [100, 'City cannot exceed 100 characters'],
        default: ''
    },

    country: {
        type: String,
        trim: true,
        maxlength: [100, 'Country cannot exceed 100 characters'],
        default: ''
    },

    // Short bio
    bio: {
        type: String,
        trim: true,
        maxlength: [500, 'Bio cannot exceed 500 characters'],
        default: ''
    },

    // Preferences
    preferences: {
        favoriteFood: {
            type: String,
            trim: true,
            default: ''
        },
        favoriteColor: {
            type: String,
            trim: true,
            default: ''
        },
        favoriteMovie: {
            type: String,
            trim: true,
            default: ''
        },
        favoriteSong: {
            type: String,
            trim: true,
            default: ''
        },
        favoritePlace: {
            type: String,
            trim: true,
            default: ''
        },
        favoriteHobby: {
            type: String,
            trim: true,
            default: ''
        },
        favoriteFlower: {
            type: String,
            trim: true,
            default: ''
        }
    },

    // Current mood with status
    mood: {
        current: {
            type: String,
            enum: ['happy', 'sad', 'missing_you', 'in_love', 'tired', 'excited', 'angry', 'neutral'],
            default: 'neutral'
        },
        status: {
            type: String,
            trim: true,
            maxlength: [100, 'Mood status cannot exceed 100 characters'],
            default: ''
        },
        updatedAt: {
            type: Date,
            default: null
        }
    },

    // Silent Care Mode (soft availability signal + optional auto-reply)
    silentCare: {
        status: {
            type: String,
            enum: ['available', 'busy', 'working', 'sleeping'],
            default: 'available'
        },
        autoReplyEnabled: {
            type: Boolean,
            default: false
        },
        autoReplyMessage: {
            type: String,
            trim: true,
            maxlength: [240, 'Auto reply message cannot exceed 240 characters'],
            default: "I'm busy right now, will talk later ❤️"
        },
        updatedAt: {
            type: Date,
            default: null
        }
    },

    // Mood history (last 50 entries)
    moodHistory: [{
        mood: {
            type: String,
            enum: ['happy', 'sad', 'missing_you', 'in_love', 'tired', 'excited', 'angry', 'neutral']
        },
        status: String,
        setAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Location coordinates for distance calculation
    location: {
        latitude: {
            type: Number,
            default: null
        },
        longitude: {
            type: Number,
            default: null
        },
        lastUpdated: {
            type: Date,
            default: null
        },
        locationName: {
            type: String,
            trim: true,
            default: ''
        }
    },

    // Reference to couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        default: null
    },

    // Spotify Integration
    spotify: {
        connected: {
            type: Boolean,
            default: false
        },
        accessToken: {
            type: String,
            default: null
        },
        refreshToken: {
            type: String,
            default: null
        },
        tokenExpiry: {
            type: Date,
            default: null
        },
        spotifyId: {
            type: String,
            default: null
        },
        displayName: {
            type: String,
            default: null
        },
        profileUrl: {
            type: String,
            default: null
        }
    },

    // Couple Lock - Additional security layer
    coupleLock: {
        enabled: {
            type: Boolean,
            default: false
        },
        type: {
            type: String,
            enum: ['pin', 'pattern', 'biometric', 'none'],
            default: 'none'
        },
        // Hashed PIN (4-6 digits)
        pinHash: {
            type: String,
            default: null,
            select: false
        },
        // Hashed pattern (sequence of dots 0-8)
        patternHash: {
            type: String,
            default: null,
            select: false
        },
        // Biometric enabled (requires device support)
        biometricEnabled: {
            type: Boolean,
            default: false
        },
        // Auto-lock timeout in minutes (0 = always locked)
        autoLockTimeout: {
            type: Number,
            default: 0,
            min: 0,
            max: 60
        },
        // Failed attempts counter
        failedAttempts: {
            type: Number,
            default: 0
        },
        // Lockout until (if too many failed attempts)
        lockoutUntil: {
            type: Date,
            default: null
        },
        // Last unlocked timestamp
        lastUnlocked: {
            type: Date,
            default: null
        },
        // Security question for recovery
        recoveryQuestion: {
            type: String,
            trim: true,
            default: ''
        },
        recoveryAnswerHash: {
            type: String,
            default: null,
            select: false
        }
    },

    // Account creation timestamp
    createdAt: {
        type: Date,
        default: Date.now
    },

    // Profile updated timestamp
    updatedAt: {
        type: Date,
        default: Date.now
    },

    // Last seen timestamp (updated on user activity)
    lastSeen: {
        type: Date,
        default: Date.now
    },

    // Firebase Cloud Messaging token for push notifications
    fcmToken: {
        type: String,
        default: null
    },

    // Device info for push notifications
    deviceInfo: {
        platform: {
            type: String,
            enum: ['android', 'ios', 'web'],
            default: null
        },
        lastUpdated: {
            type: Date,
            default: null
        }
    }
});

// ===========================================
// Password Hashing Middleware
// Automatically hash password before saving
// ===========================================

userSchema.pre('save', async function(next) {
    // Update the updatedAt timestamp
    this.updatedAt = Date.now();
    
    // Only hash password if it's new or modified
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Generate salt (10 rounds is good balance of security/speed)
        const salt = await bcrypt.genSalt(10);
        
        // Hash the password with the salt
        this.password = await bcrypt.hash(this.password, salt);
        
        next();
    } catch (error) {
        next(error);
    }
});

// ===========================================
// Instance Methods
// ===========================================

// Compare entered password with stored hashed password
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Create and export the model
const User = mongoose.model('User', userSchema);

module.exports = User;
