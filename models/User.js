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

    // Current mood
    mood: {
        type: String,
        enum: ['happy', 'sad', 'missing_you', 'in_love', 'tired', 'excited', 'neutral'],
        default: 'neutral'
    },

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

    // Account creation timestamp
    createdAt: {
        type: Date,
        default: Date.now
    },

    // Profile updated timestamp
    updatedAt: {
        type: Date,
        default: Date.now
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
