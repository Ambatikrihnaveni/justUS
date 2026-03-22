// ===========================================
// Streak Routes
// Handles couple streak tracking endpoints
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    getStreakData,
    recordManualInteraction,
    getMilestones,
    getMissYouAlertStatus
} = require('../controllers/streakController');

// All routes require authentication
router.use(protect);

// ===========================================
// Streak Routes
// ===========================================

// Get current streak data
router.get('/', getStreakData);

// Record an interaction manually
router.post('/interaction', recordManualInteraction);

// Get milestone achievements
router.get('/milestones', getMilestones);

// Get inactivity-based miss you alert status
router.get('/miss-you-alert', getMissYouAlertStatus);

module.exports = router;
