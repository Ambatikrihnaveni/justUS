// ===========================================
// File Upload Middleware
// Handles image and file uploads using Multer
// ===========================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ===========================================
// Multer Storage Configuration
// ===========================================

const storage = multer.diskStorage({
    // Set destination folder
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    // Set filename: timestamp + original name
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// ===========================================
// File Filter
// Only allow certain file types
// ===========================================

const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // Audio types for voice messages
        'audio/webm',
        'audio/mp3',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/mp4',
        'audio/aac',
        // Video types
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo',
        'video/3gpp',
        'video/x-matroska'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, documents, audio, and video are allowed.'), false);
    }
};

// ===========================================
// Multer Upload Configuration
// ===========================================

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max file size for videos
    }
});

// ===========================================
// Upload Middleware Exports
// ===========================================

// Single image upload
const uploadImage = upload.single('image');

// Single voice upload
const uploadVoice = upload.single('voice');

// Single video upload
const uploadVideo = upload.single('video');

// Single file upload (generic)
const uploadFile = upload.single('file');

// Multiple images upload (max 5)
const uploadMultipleImages = upload.array('images', 5);

// ===========================================
// Error Handler for Multer
// ===========================================

const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 10MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    next();
};

module.exports = {
    uploadImage,
    uploadVoice,
    uploadVideo,
    uploadFile,
    uploadMultipleImages,
    handleUploadError
};
