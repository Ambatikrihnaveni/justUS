// ===========================================
// Couple Theme Controller
// Handles theme customization operations
// ===========================================

const CoupleTheme = require('../models/CoupleTheme');
const Couple = require('../models/Couple');

// ===========================================
// Get Couple Theme
// ===========================================

exports.getCoupleTheme = async (req, res) => {
    try {
        const coupleId = req.user.coupleId;

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You are not part of a couple'
            });
        }

        // Try to find existing theme
        let theme = await CoupleTheme.findOne({ coupleId });

        // If no theme exists, return default
        if (!theme) {
            const defaultTheme = CoupleTheme.getDefaultTheme(coupleId);
            return res.json({
                success: true,
                theme: defaultTheme,
                isDefault: true
            });
        }

        res.json({
            success: true,
            theme,
            isDefault: false
        });
    } catch (error) {
        console.error('Error getting couple theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get theme'
        });
    }
};

// ===========================================
// Update Couple Theme
// ===========================================

exports.updateCoupleTheme = async (req, res) => {
    try {
        const coupleId = req.user.coupleId;
        const userId = req.user._id;

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You are not part of a couple'
            });
        }

        const {
            wallpaper,
            colorTheme,
            customColors,
            themeStyle,
            bubbleStyle,
            fontSettings,
            effects
        } = req.body;

        // Build update object with only provided fields
        const updateData = {
            lastUpdatedBy: userId
        };

        if (wallpaper !== undefined) updateData.wallpaper = wallpaper;
        if (colorTheme !== undefined) updateData.colorTheme = colorTheme;
        if (customColors !== undefined) updateData.customColors = customColors;
        if (themeStyle !== undefined) updateData.themeStyle = themeStyle;
        if (bubbleStyle !== undefined) updateData.bubbleStyle = bubbleStyle;
        if (fontSettings !== undefined) updateData.fontSettings = fontSettings;
        if (effects !== undefined) updateData.effects = effects;

        // Upsert - create if doesn't exist, update if does
        const theme = await CoupleTheme.findOneAndUpdate(
            { coupleId },
            { $set: updateData },
            { new: true, upsert: true, runValidators: true }
        );

        // Get partner ID to notify them
        const couple = await Couple.findById(coupleId);
        const partnerId = couple.partner1.toString() === userId.toString()
            ? couple.partner2?.toString()
            : couple.partner1.toString();

        res.json({
            success: true,
            theme,
            partnerId, // Frontend will use this to notify partner via socket
            message: 'Theme updated successfully'
        });
    } catch (error) {
        console.error('Error updating couple theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update theme'
        });
    }
};

// ===========================================
// Reset Theme to Default
// ===========================================

exports.resetCoupleTheme = async (req, res) => {
    try {
        const coupleId = req.user.coupleId;
        const userId = req.user._id;

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You are not part of a couple'
            });
        }

        // Delete existing theme
        await CoupleTheme.findOneAndDelete({ coupleId });

        // Get partner ID to notify them
        const couple = await Couple.findById(coupleId);
        const partnerId = couple.partner1.toString() === userId.toString()
            ? couple.partner2?.toString()
            : couple.partner1.toString();

        const defaultTheme = CoupleTheme.getDefaultTheme(coupleId);

        res.json({
            success: true,
            theme: defaultTheme,
            partnerId,
            message: 'Theme reset to default'
        });
    } catch (error) {
        console.error('Error resetting couple theme:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset theme'
        });
    }
};

// ===========================================
// Upload Custom Wallpaper
// ===========================================

exports.uploadWallpaper = async (req, res) => {
    try {
        const coupleId = req.user.coupleId;
        const userId = req.user._id;

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You are not part of a couple'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // The file URL from cloudinary or local upload
        const wallpaperUrl = req.file.path || req.file.location || `/uploads/${req.file.filename}`;

        // Update theme with custom wallpaper
        const theme = await CoupleTheme.findOneAndUpdate(
            { coupleId },
            {
                $set: {
                    'wallpaper.type': 'custom',
                    'wallpaper.customUrl': wallpaperUrl,
                    lastUpdatedBy: userId
                }
            },
            { new: true, upsert: true }
        );

        // Get partner ID
        const couple = await Couple.findById(coupleId);
        const partnerId = couple.partner1.toString() === userId.toString()
            ? couple.partner2?.toString()
            : couple.partner1.toString();

        res.json({
            success: true,
            wallpaperUrl,
            theme,
            partnerId,
            message: 'Wallpaper uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading wallpaper:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload wallpaper'
        });
    }
};

// ===========================================
// Get Theme Options (for UI)
// ===========================================

exports.getThemeOptions = async (req, res) => {
    try {
        res.json({
            success: true,
            options: {
                wallpapers: CoupleTheme.WALLPAPER_OPTIONS,
                colorThemes: CoupleTheme.COLOR_THEMES,
                themeStyles: CoupleTheme.THEME_STYLES
            }
        });
    } catch (error) {
        console.error('Error getting theme options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get theme options'
        });
    }
};
