// ===========================================
// Authentication Controller
// Handles signup and login logic
// ===========================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Helper: Generate JWT Token
// ===========================================

const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// ===========================================
// Helper: Generate Unique Invite Code
// ===========================================

const generateInviteCode = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0,O,1,I)
    let code;
    let isUnique = false;
    
    while (!isUnique) {
        code = 'JU';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existing = await Couple.findOne({ inviteCode: code });
        if (!existing) isUnique = true;
    }
    
    return code;
};

// ===========================================
// Signup - Create new user account
// POST /api/auth/signup
// Optionally accepts inviteCode to join existing couple
// ===========================================

const signup = async (req, res) => {
    try {
        const { name, email, password, inviteCode, avatar } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email, and password'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        let couple = null;
        let isJoiningCouple = false;

        // If invite code provided, validate and prepare to join
        if (inviteCode && inviteCode.trim()) {
            couple = await Couple.findOne({ inviteCode: inviteCode.toUpperCase() });
            
            if (!couple) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid invite code. Please check and try again.'
                });
            }

            // Check if couple is already full (max 2 users)
            if (couple.partner2 || couple.isComplete) {
                return res.status(400).json({
                    success: false,
                    message: 'Couple space already full. Maximum 2 users allowed.'
                });
            }

            isJoiningCouple = true;
        }

        // Create new user
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            avatar: avatar || ''
        });

        // Handle couple logic
        if (isJoiningCouple && couple) {
            // Join existing couple as partner2
            couple.partner2 = user._id;
            couple.isComplete = true;
            await couple.save();
            
            // Update user with couple reference
            user.coupleId = couple._id;
            await user.save();

            // Populate partner info
            await couple.populate('partner1', 'name email avatar');
            await couple.populate('partner2', 'name email avatar');
        } else {
            // Create new couple space
            const newInviteCode = await generateInviteCode();
            
            couple = await Couple.create({
                partner1: user._id,
                inviteCode: newInviteCode,
                createdBy: user._id,
                maxUsers: 2
            });

            // Update user with couple reference
            user.coupleId = couple._id;
            await user.save();

            // Populate partner info
            await couple.populate('partner1', 'name email avatar');
        }

        // Generate JWT token
        const token = generateToken(user._id);

        // Send response
        res.status(201).json({
            success: true,
            message: isJoiningCouple 
                ? 'Account created and joined couple space!' 
                : 'Account created successfully! Share your invite code with your partner.',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                coupleId: user.coupleId,
                createdAt: user.createdAt
            },
            couple: {
                _id: couple._id,
                inviteCode: couple.inviteCode,
                isComplete: couple.isComplete,
                partner1: couple.partner1,
                partner2: couple.partner2 || null
            }
        });

    } catch (error) {
        console.error('Signup error:', error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join('. ')
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating account. Please try again.'
        });
    }
};

// ===========================================
// Login - Authenticate existing user
// POST /api/auth/login
// ===========================================

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user by email (include password for comparison)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        // Check if user exists
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Compare passwords
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = generateToken(user._id);

        // Send response (exclude password)
        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in. Please try again.'
        });
    }
};

// ===========================================
// Get Current User - Get logged in user info
// GET /api/auth/me
// ===========================================

const getMe = async (req, res) => {
    try {
        // User is already attached by auth middleware
        const user = await User.findById(req.user._id);

        res.status(200).json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                silentCare: user.silentCare,
                coupleId: user.coupleId,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user data'
        });
    }
};

// ===========================================
// Get Partner - Get the other user in the same couple
// GET /api/auth/partner
// Security: Only returns partner from same couple_id
// ===========================================

const getPartner = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        
        // Check if user has a couple
        if (!currentUser.coupleId) {
            return res.status(404).json({
                success: false,
                message: 'You are not part of a couple yet. Create a couple space first!'
            });
        }

        // Find the couple to get partner info
        const couple = await Couple.findById(currentUser.coupleId)
            .populate('partner1', 'name email avatar createdAt silentCare lastSeen')
            .populate('partner2', 'name email avatar createdAt silentCare lastSeen');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found.'
            });
        }

        // Determine which partner to return (the one that's not the current user)
        let partner = null;
        if (couple.partner1 && couple.partner1._id.toString() !== currentUser._id.toString()) {
            partner = couple.partner1;
        } else if (couple.partner2 && couple.partner2._id.toString() !== currentUser._id.toString()) {
            partner = couple.partner2;
        }

        if (!partner) {
            return res.status(404).json({
                success: false,
                message: 'Partner not found. Share your invite code with them!'
            });
        }

        res.status(200).json({
            success: true,
            partner: {
                _id: partner._id,
                name: partner.name,
                email: partner.email,
                avatar: partner.avatar,
                silentCare: partner.silentCare,
                lastSeen: partner.lastSeen,
                createdAt: partner.createdAt
            }
        });

    } catch (error) {
        console.error('Get partner error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching partner data'
        });
    }
};

// ===========================================
// Update FCM Token - Save push notification token
// PUT /api/auth/fcm-token
// ===========================================

const updateFcmToken = async (req, res) => {
    try {
        const { fcmToken, platform } = req.body;
        const userId = req.user._id;

        if (!fcmToken) {
            return res.status(400).json({
                success: false,
                message: 'FCM token is required'
            });
        }

        // Update user's FCM token
        await User.findByIdAndUpdate(userId, {
            fcmToken,
            deviceInfo: {
                platform: platform || 'android',
                lastUpdated: new Date()
            }
        });

        console.log(`🔔 FCM token updated for user ${userId}`);

        res.status(200).json({
            success: true,
            message: 'FCM token updated successfully'
        });

    } catch (error) {
        console.error('Update FCM token error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating FCM token'
        });
    }
};

module.exports = {
    signup,
    login,
    getMe,
    getPartner,
    updateFcmToken
};
