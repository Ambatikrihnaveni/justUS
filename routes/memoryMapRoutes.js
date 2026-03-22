// ===========================================
// Memory Map Routes
// Routes for map-based memory viewing
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getMemoriesWithLocations,
    addLocationToMemory,
    getMapStats
} = require('../controllers/memoryMapController');

// ===========================================
// Route Definitions
// ===========================================

// GET /api/memory-map - Get all memories with location data
router.get('/', protect, getMemoriesWithLocations);

// GET /api/memory-map/stats - Get map statistics
router.get('/stats', protect, getMapStats);

// PUT /api/memory-map/:memoryId/location - Add location to a memory
router.put('/:memoryId/location', protect, addLocationToMemory);

module.exports = router;
