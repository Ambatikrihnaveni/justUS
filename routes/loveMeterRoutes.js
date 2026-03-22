// ===========================================
// Love Meter Routes
// Routes for relationship score calculation
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    getLoveMeterScore,
    getMilestones
} = require('../controllers/loveMeterController');

// All routes require authentication
router.use(protect);

// ===========================================
// Routes
// ===========================================

// Get milestones list - must be before other routes
router.get('/milestones', getMilestones);

// Get love meter score
router.get('/', getLoveMeterScore);

module.exports = router;
