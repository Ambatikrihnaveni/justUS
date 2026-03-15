// ===========================================
// Call Routes
// Handles call history API endpoints
// ===========================================

const express = require('express');
const router = express.Router();
const Call = require('../models/Call');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// ===========================================
// Get Call History with partner
// GET /api/calls/:userId
// ===========================================

router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        // Find all calls between these two users
        const calls = await Call.find({
            $or: [
                { callerId: currentUserId, receiverId: userId },
                { callerId: userId, receiverId: currentUserId }
            ]
        })
        .sort({ createdAt: -1 }) // Most recent first
        .limit(50) // Last 50 calls
        .populate('callerId', 'name avatar')
        .populate('receiverId', 'name avatar');

        res.status(200).json({
            success: true,
            count: calls.length,
            calls
        });

    } catch (error) {
        console.error('Get call history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching call history'
        });
    }
});

// ===========================================
// Get All Call History for current user
// GET /api/calls
// ===========================================

router.get('/', async (req, res) => {
    try {
        const currentUserId = req.user._id;

        // Find all calls involving current user
        const calls = await Call.find({
            $or: [
                { callerId: currentUserId },
                { receiverId: currentUserId }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('callerId', 'name avatar')
        .populate('receiverId', 'name avatar');

        res.status(200).json({
            success: true,
            count: calls.length,
            calls
        });

    } catch (error) {
        console.error('Get all calls error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching calls'
        });
    }
});

// ===========================================
// Save Call Record (called from socket events)
// POST /api/calls
// ===========================================

router.post('/', async (req, res) => {
    try {
        const { receiverId, type, status, duration } = req.body;
        const callerId = req.user._id;

        const call = await Call.create({
            callerId,
            receiverId,
            type,
            status,
            duration: duration || 0,
            startedAt: new Date(Date.now() - (duration || 0) * 1000),
            endedAt: new Date()
        });

        await call.populate('callerId', 'name avatar');
        await call.populate('receiverId', 'name avatar');

        res.status(201).json({
            success: true,
            call
        });

    } catch (error) {
        console.error('Save call error:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving call'
        });
    }
});

module.exports = router;
