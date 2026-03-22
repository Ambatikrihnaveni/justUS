// ===========================================
// Couple Theme Routes
// API routes for theme customization
// ===========================================

const express = require('express');
const router = express.Router();
const coupleThemeController = require('../controllers/coupleThemeController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// All routes require authentication
router.use(protect);

// Get theme options (wallpapers, colors, styles)
router.get('/options', coupleThemeController.getThemeOptions);

// Get couple's current theme
router.get('/', coupleThemeController.getCoupleTheme);

// Update couple's theme
router.put('/', coupleThemeController.updateCoupleTheme);

// Reset theme to default
router.delete('/reset', coupleThemeController.resetCoupleTheme);

// Upload custom wallpaper
router.post('/wallpaper', upload.single('wallpaper'), coupleThemeController.uploadWallpaper);

module.exports = router;
