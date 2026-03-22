// ===========================================
// Authentication Routes
// Handles user signup and login
// ===========================================

const express = require('express');
const router = express.Router();

// Import controller functions
const { 
    signup, 
    login, 
    getMe, 
    getPartner,
    updateFcmToken,
    forgotPassword,
    resetPassword,
    changePassword
} = require('../controllers/authController');

// Import auth middleware
const { protect } = require('../middleware/authMiddleware');

// ===========================================
// Public Routes (no authentication required)
// ===========================================

// POST /api/auth/signup - Register new user
router.post('/signup', signup);

// POST /api/auth/login - Login user
router.post('/login', login);

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', forgotPassword);

// POST /api/auth/reset-password - Reset password with code
router.post('/reset-password', resetPassword);

// ===========================================
// Protected Routes (authentication required)
// ===========================================

// GET /api/auth/me - Get current logged in user
router.get('/me', protect, getMe);

// GET /api/auth/partner - Get partner user
router.get('/partner', protect, getPartner);

// PUT /api/auth/fcm-token - Update FCM token for push notifications
router.put('/fcm-token', protect, updateFcmToken);

// PUT /api/auth/change-password - Change password (logged in user)
router.put('/change-password', protect, changePassword);

module.exports = router;
