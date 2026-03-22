// ===========================================
// Transcription Routes
// API routes for voice message transcription
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
    retryTranscription, 
    isTranscriptionAvailable 
} = require('../services/transcriptionService');
const Message = require('../models/Message');

// All routes require authentication
router.use(protect);

// ===========================================
// Check Transcription Availability
// GET /api/transcription/status
// ===========================================

router.get('/status', (req, res) => {
    res.json({
        success: true,
        available: isTranscriptionAvailable(),
        message: isTranscriptionAvailable() 
            ? 'Transcription service is available' 
            : 'Transcription service not configured (OPENAI_API_KEY missing)'
    });
});

// ===========================================
// Get Transcription for Message
// GET /api/transcription/:messageId
// ===========================================

router.get('/:messageId', async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Verify user has access to this message
        const userId = req.user._id.toString();
        if (message.senderId.toString() !== userId && 
            message.receiverId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (message.type !== 'voice') {
            return res.status(400).json({
                success: false,
                message: 'Not a voice message'
            });
        }

        res.json({
            success: true,
            transcription: message.transcription || { status: 'not_available' }
        });

    } catch (error) {
        console.error('Get transcription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get transcription'
        });
    }
});

// ===========================================
// Retry Failed Transcription
// POST /api/transcription/:messageId/retry
// ===========================================

router.post('/:messageId/retry', async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Verify user has access to this message
        const userId = req.user._id.toString();
        if (message.senderId.toString() !== userId && 
            message.receiverId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (message.type !== 'voice') {
            return res.status(400).json({
                success: false,
                message: 'Not a voice message'
            });
        }

        if (!isTranscriptionAvailable()) {
            return res.status(503).json({
                success: false,
                message: 'Transcription service not available'
            });
        }

        const updatedMessage = await retryTranscription(req.params.messageId);

        res.json({
            success: true,
            message: 'Transcription retry initiated',
            transcription: updatedMessage.transcription
        });

    } catch (error) {
        console.error('Retry transcription error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to retry transcription'
        });
    }
});

module.exports = router;
