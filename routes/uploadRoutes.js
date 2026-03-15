// ===========================================
// Upload Routes
// Handles file upload endpoints
// ===========================================

const express = require('express');
const router = express.Router();
const path = require('path');

// Import middleware
const { protect } = require('../middleware/authMiddleware');
const { uploadImage, uploadVoice, uploadVideo, uploadFile, handleUploadError } = require('../middleware/uploadMiddleware');
const Message = require('../models/Message');

// All upload routes require authentication
router.use(protect);

// ===========================================
// Upload Image for Chat
// POST /api/upload/image
// ===========================================

router.post('/image', uploadImage, handleUploadError, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Create the file URL
        const fileUrl = `/uploads/${req.file.filename}`;

        // If receiverId is provided, create a message
        if (req.body.receiverId) {
            const newMessage = await Message.create({
                senderId: req.user._id,
                receiverId: req.body.receiverId,
                message: req.body.caption || 'Image',
                type: 'image',
                filePath: fileUrl
            });

            await newMessage.populate('senderId', 'name avatar');
            await newMessage.populate('receiverId', 'name avatar');

            // Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.to(req.body.receiverId).emit('newMessage', newMessage);
            }

            return res.status(201).json({
                success: true,
                message: 'Image uploaded and message sent',
                data: newMessage,
                filePath: fileUrl
            });
        }

        // Just return the file path if no receiver
        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            filePath: fileUrl,
            fileName: req.file.filename
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading file'
        });
    }
});

// ===========================================
// Upload Voice Message
// POST /api/upload/voice
// ===========================================

router.post('/voice', uploadVoice, handleUploadError, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No voice file uploaded'
            });
        }

        // Create the file URL
        const fileUrl = `/uploads/${req.file.filename}`;

        // If receiverId is provided, create a message
        if (req.body.receiverId) {
            const newMessage = await Message.create({
                senderId: req.user._id,
                receiverId: req.body.receiverId,
                message: 'Voice message',
                type: 'voice',
                filePath: fileUrl,
                duration: parseFloat(req.body.duration) || 0
            });

            await newMessage.populate('senderId', 'name avatar');
            await newMessage.populate('receiverId', 'name avatar');

            // Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.to(req.body.receiverId).emit('newMessage', newMessage);
            }

            return res.status(201).json({
                success: true,
                message: 'Voice message sent',
                data: newMessage,
                filePath: fileUrl
            });
        }

        // Just return the file path if no receiver
        res.status(200).json({
            success: true,
            message: 'Voice uploaded successfully',
            filePath: fileUrl,
            fileName: req.file.filename
        });

    } catch (error) {
        console.error('Voice upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading voice message'
        });
    }
});

// ===========================================
// Upload Video Message
// POST /api/upload/video
// ===========================================

router.post('/video', uploadVideo, handleUploadError, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No video file uploaded'
            });
        }

        // Create the file URL
        const fileUrl = `/uploads/${req.file.filename}`;

        // If receiverId is provided, create a message
        if (req.body.receiverId) {
            const isVideoNote = req.body.isVideoNote === 'true';
            const newMessage = await Message.create({
                senderId: req.user._id,
                receiverId: req.body.receiverId,
                message: isVideoNote ? 'Video note' : 'Video',
                type: isVideoNote ? 'videoNote' : 'video',
                filePath: fileUrl,
                duration: parseFloat(req.body.duration) || 0
            });

            await newMessage.populate('senderId', 'name avatar');
            await newMessage.populate('receiverId', 'name avatar');

            // Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.to(req.body.receiverId).emit('newMessage', newMessage);
            }

            return res.status(201).json({
                success: true,
                message: 'Video message sent',
                data: newMessage,
                filePath: fileUrl
            });
        }

        // Just return the file path if no receiver
        res.status(200).json({
            success: true,
            message: 'Video uploaded successfully',
            filePath: fileUrl,
            fileName: req.file.filename
        });

    } catch (error) {
        console.error('Video upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading video'
        });
    }
});

// ===========================================
// Upload File (generic documents)
// POST /api/upload/file
// ===========================================

router.post('/file', uploadFile, handleUploadError, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Create the file URL
        const fileUrl = `/uploads/${req.file.filename}`;
        const fileName = req.file.originalname;
        const fileSize = req.file.size;

        // If receiverId is provided, create a message
        if (req.body.receiverId) {
            const newMessage = await Message.create({
                senderId: req.user._id,
                receiverId: req.body.receiverId,
                message: fileName,
                type: 'file',
                filePath: fileUrl,
                fileName: fileName,
                fileSize: fileSize
            });

            await newMessage.populate('senderId', 'name avatar');
            await newMessage.populate('receiverId', 'name avatar');

            // Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.to(req.body.receiverId).emit('newMessage', newMessage);
            }

            return res.status(201).json({
                success: true,
                message: 'File sent',
                data: newMessage,
                filePath: fileUrl
            });
        }

        // Just return the file path if no receiver
        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            filePath: fileUrl,
            fileName: req.file.filename
        });

    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading file'
        });
    }
});

// ===========================================
// Send GIF/Sticker Message
// POST /api/upload/gif
// ===========================================

router.post('/gif', async (req, res) => {
    try {
        const { receiverId, gifUrl, soundUrl, caption } = req.body;

        if (!receiverId || !gifUrl) {
            return res.status(400).json({
                success: false,
                message: 'Receiver and GIF URL are required'
            });
        }

        const newMessage = await Message.create({
            senderId: req.user._id,
            receiverId,
            message: caption !== undefined ? caption : '',
            type: 'gif',
            gifUrl,
            soundUrl: soundUrl || ''
        });

        await newMessage.populate('senderId', 'name avatar');
        await newMessage.populate('receiverId', 'name avatar');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(receiverId).emit('newMessage', newMessage);
        }

        res.status(201).json({
            success: true,
            message: 'GIF sent',
            data: newMessage
        });

    } catch (error) {
        console.error('GIF send error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending GIF'
        });
    }
});

// ===========================================
// Send Current Location Message
// POST /api/upload/location
// ===========================================

router.post('/location', async (req, res) => {
    try {
        const { receiverId, latitude, longitude, accuracy, address } = req.body;
        console.log('📍 Location request:', { receiverId, latitude, longitude, accuracy, address });

        if (!receiverId || latitude === undefined || longitude === undefined) {
            console.log('📍 Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Receiver and location coordinates are required'
            });
        }

        const newMessage = await Message.create({
            senderId: req.user._id,
            receiverId,
            message: address || 'Current Location',
            type: 'location',
            location: {
                latitude,
                longitude,
                accuracy: accuracy || null,
                address: address || ''
            }
        });
        console.log('📍 Location message created:', newMessage._id);

        await newMessage.populate('senderId', 'name avatar');
        await newMessage.populate('receiverId', 'name avatar');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(receiverId).emit('newMessage', newMessage);
        }

        res.status(201).json({
            success: true,
            message: 'Location sent',
            data: newMessage
        });

    } catch (error) {
        console.error('Location send error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending location'
        });
    }
});

// ===========================================
// Start Live Location Sharing
// POST /api/upload/live-location
// ===========================================

router.post('/live-location', async (req, res) => {
    try {
        const { receiverId, latitude, longitude, accuracy, duration } = req.body;

        if (!receiverId || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Receiver and location coordinates are required'
            });
        }

        // Duration in minutes (default 15 mins)
        const durationMins = duration || 15;
        const expiresAt = new Date(Date.now() + durationMins * 60 * 1000);

        const newMessage = await Message.create({
            senderId: req.user._id,
            receiverId,
            message: `Live Location (${durationMins} min)`,
            type: 'liveLocation',
            location: {
                latitude,
                longitude,
                accuracy: accuracy || null
            },
            liveLocationDuration: durationMins,
            liveLocationExpiresAt: expiresAt,
            liveLocationActive: true
        });

        await newMessage.populate('senderId', 'name avatar');
        await newMessage.populate('receiverId', 'name avatar');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(receiverId).emit('newMessage', newMessage);
        }

        res.status(201).json({
            success: true,
            message: 'Live location started',
            data: newMessage
        });

    } catch (error) {
        console.error('Live location start error:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting live location'
        });
    }
});

// ===========================================
// Stop Live Location Sharing
// PUT /api/upload/live-location/:messageId/stop
// ===========================================

router.put('/live-location/:messageId/stop', async (req, res) => {
    try {
        const { messageId } = req.params;

        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        if (message.senderId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to stop this live location'
            });
        }

        message.liveLocationActive = false;
        await message.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(message.receiverId.toString()).emit('liveLocationStopped', {
                messageId: message._id,
                senderId: req.user._id
            });
        }

        res.status(200).json({
            success: true,
            message: 'Live location stopped',
            data: message
        });

    } catch (error) {
        console.error('Stop live location error:', error);
        res.status(500).json({
            success: false,
            message: 'Error stopping live location'
        });
    }
});

module.exports = router;
