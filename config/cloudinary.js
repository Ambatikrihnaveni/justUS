// ===========================================
// Cloudinary Configuration
// Cloud storage for images, audio, and video
// ===========================================

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ===========================================
// Cloudinary Storage for Images
// ===========================================

const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'justus/images',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 1024, height: 1024, crop: 'limit' }], // Limit max size
        resource_type: 'image'
    }
});

// ===========================================
// Cloudinary Storage for Audio/Voice Messages
// ===========================================

const audioStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'justus/audio',
        allowed_formats: ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac'],
        resource_type: 'video' // Cloudinary uses 'video' for audio files
    }
});

// ===========================================
// Cloudinary Storage for Video
// ===========================================

const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'justus/videos',
        allowed_formats: ['mp4', 'webm', 'mov', 'avi'],
        resource_type: 'video'
    }
});

// ===========================================
// Multer Upload Instances
// ===========================================

const uploadImageCloud = multer({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).single('image');

const uploadVoiceCloud = multer({
    storage: audioStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
}).single('voice');

const uploadVideoCloud = multer({
    storage: videoStorage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
}).single('video');

// ===========================================
// Delete File from Cloudinary
// ===========================================

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        return result;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw error;
    }
};

// ===========================================
// Get Cloudinary URL from file
// ===========================================

const getCloudinaryUrl = (file) => {
    // If file was uploaded to Cloudinary, it has a 'path' property with the URL
    if (file && file.path) {
        return file.path;
    }
    return null;
};

// ===========================================
// Error Handler
// ===========================================

const handleCloudinaryError = (err, req, res, next) => {
    if (err) {
        console.error('Cloudinary upload error:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Error uploading file to cloud storage'
        });
    }
    next();
};

module.exports = {
    cloudinary,
    uploadImageCloud,
    uploadVoiceCloud,
    uploadVideoCloud,
    deleteFromCloudinary,
    getCloudinaryUrl,
    handleCloudinaryError
};
