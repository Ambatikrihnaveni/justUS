// ===========================================
// Couple Lock Routes
// Routes for private security layer
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const lockController = require('../controllers/lockController');

// ===========================================
// All routes require authentication
// ===========================================

// Get lock status
router.get('/status', protect, lockController.getLockStatus);

// Setup lock methods
router.post('/setup/pin', protect, lockController.setupPinLock);
router.post('/setup/pattern', protect, lockController.setupPatternLock);
router.post('/setup/biometric', protect, lockController.enableBiometric);

// Verify lock
router.post('/verify/pin', protect, lockController.verifyPin);
router.post('/verify/pattern', protect, lockController.verifyPattern);
router.post('/verify/biometric', protect, lockController.verifyBiometric);

// Manage lock
router.put('/settings', protect, lockController.updateLockSettings);
router.post('/disable', protect, lockController.disableLock);

// Change PIN/Pattern
router.put('/change/pin', protect, lockController.changePin);
router.put('/change/pattern', protect, lockController.changePattern);

// Recovery
router.get('/recovery/question', protect, lockController.getRecoveryQuestion);
router.post('/recovery/verify', protect, lockController.verifyRecovery);

module.exports = router;
