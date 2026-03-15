// ===========================================
// Cloud Upload Routes
// Handles file uploads to Cloudinary (production)
// Use these routes when deploying to cloud hosting
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');
const Message = require('../models/Message');

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
    return process.env.CLOUDINARY_CLOUD_NAME && 
           process.env.CLOUDINARY_API_KEY && 
           process.env.CLOUDINARY_API_SECRET;
};

// Import appropriate upload middleware based on environment
let uploadImage, uploadVoice, uploadVideo, handleUploadError, getFileUrl;

if (isCloudinaryConfigured()) {
    const cloudinary = require('../config/cloudinary');
    uploadImage = cloudinary.uploadImageCloud;
    uploadVoice = cloudinary.uploadVoiceCloud;
    uploadVideo = cloudinary.uploadVideoCloud;
    handleUploadError = cloudinary.handleCloudinaryError;
    getFileUrl = (file) => file.path; // Cloudinary returns full URL in path
} else {
    const localUpload = require('../middleware/uploadMiddleware');
    uploadImage = localUpload.uploadImage;
    uploadVoice = localUpload.uploadVoice;
    uploadVideo = localUpload.uploadVideo;
    handleUploadError = localUpload.handleUploadError;
    getFileUrl = (file) => `/uploads/${file.filename}`; // Local path
}

// All upload routes require authentication
router.use(protect);

// ===========================================
// Upload Image for Chat
// POST /api/upload/image
// ===========================================

router.post('/image', (req, res, next) => {
    uploadImage(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Error uploading image'
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const fileUrl = getFileUrl(req.file);

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

            res.status(200).json({
                success: true,
                message: 'Image uploaded successfully',
                filePath: fileUrl,
                fileName: req.file.filename || req.file.public_id
            });

        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({
                success: false,
                message: 'Error uploading file'
            });
        }
    });
});

// ===========================================
// Upload Voice Message
// POST /api/upload/voice
// ===========================================

router.post('/voice', (req, res, next) => {
    uploadVoice(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Error uploading voice message'
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No voice file uploaded'
                });
            }

            const fileUrl = getFileUrl(req.file);

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

            res.status(200).json({
                success: true,
                message: 'Voice uploaded successfully',
                filePath: fileUrl,
                fileName: req.file.filename || req.file.public_id
            });

        } catch (error) {
            console.error('Voice upload error:', error);
            res.status(500).json({
                success: false,
                message: 'Error uploading voice message'
            });
        }
    });
});

// ===========================================
// Upload Video Message
// POST /api/upload/video
// ===========================================

router.post('/video', (req, res, next) => {
    uploadVideo(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Error uploading video'
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No video file uploaded'
                });
            }

            const fileUrl = getFileUrl(req.file);

            if (req.body.receiverId) {
                const newMessage = await Message.create({
                    senderId: req.user._id,
                    receiverId: req.body.receiverId,
                    message: 'Video message',
                    type: 'video',
                    filePath: fileUrl,
                    duration: parseFloat(req.body.duration) || 0
                });

                await newMessage.populate('senderId', 'name avatar');
                await newMessage.populate('receiverId', 'name avatar');

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

            res.status(200).json({
                success: true,
                message: 'Video uploaded successfully',
                filePath: fileUrl,
                fileName: req.file.filename || req.file.public_id
            });

        } catch (error) {
            console.error('Video upload error:', error);
            res.status(500).json({
                success: false,
                message: 'Error uploading video'
            });
        }
    });
});

// ===========================================
// Upload Profile Picture
// POST /api/upload/avatar
// ===========================================

router.post('/avatar', (req, res, next) => {
    uploadImage(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Error uploading avatar'
            });
        }

        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No image file uploaded'
                });
            }

            const fileUrl = getFileUrl(req.file);

            res.status(200).json({
                success: true,
                message: 'Avatar uploaded successfully',
                filePath: fileUrl,
                url: fileUrl
            });

        } catch (error) {
            console.error('Avatar upload error:', error);
            res.status(500).json({
                success: false,
                message: 'Error uploading avatar'
            });
        }
    });
});

// ===========================================
// Storage Info Endpoint
// GET /api/upload/info
// ===========================================

router.get('/info', (req, res) => {
    res.json({
        success: true,
        storage: isCloudinaryConfigured() ? 'cloudinary' : 'local',
        maxFileSize: {
            image: '10MB',
            voice: '25MB',
            video: '100MB'
        }
    });
});

module.exports = router;
