// ===========================================
// Activity Heatmap Routes
// Returns partner activity intensity by day/hour
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getActivityHeatmap } = require('../controllers/activityHeatmapController');

router.use(protect);

router.get('/', getActivityHeatmap);

module.exports = router;
