// ===========================================
// Couple Routes
// Handles couple profile and relationship endpoints
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    createCouple,
    joinCouple,
    getCoupleProfile,
    updateCoupleProfile,
    updateUserProfile,
    getUserProfile,
    updateMood,
    addMemory,
    getMemories,
    deleteMemory,
    toggleFeatureMemory,
    leaveCouple,
    updateLocation,
    getDistance
} = require('../controllers/coupleController');

// All routes require authentication
router.use(protect);

// ===========================================
// Couple Space Routes
// ===========================================

// Create a new couple space
router.post('/create', createCouple);

// Join existing couple via invite code
router.post('/join', joinCouple);

// Leave couple space
router.delete('/leave', leaveCouple);

// ===========================================
// Profile Routes
// ===========================================

// Get couple profile (includes both partners)
router.get('/profile', getCoupleProfile);

// Update couple profile (shared info)
router.put('/profile', updateCoupleProfile);

// Get user's own profile
router.get('/user-profile', getUserProfile);

// Update user's own profile
router.put('/user-profile', updateUserProfile);

// Update mood
router.put('/mood', updateMood);

// ===========================================
// Location Routes
// ===========================================

// Update user's location
router.put('/location', updateLocation);

// Get distance between partners
router.get('/distance', getDistance);

// ===========================================
// Memory Routes
// ===========================================

// Add a new memory
router.post('/memories', addMemory);

// Get all memories (with pagination)
router.get('/memories', getMemories);

// Delete a memory
router.delete('/memories/:id', deleteMemory);

// Toggle featured status of a memory
router.put('/memories/:id/feature', toggleFeatureMemory);

module.exports = router;
