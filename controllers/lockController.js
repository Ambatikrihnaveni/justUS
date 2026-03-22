// ===========================================
// Couple Lock Controller
// Private security layer for couple space
// ===========================================

const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;
const MIN_PATTERN_LENGTH = 4;

// ===========================================
// Get Lock Status
// ===========================================
exports.getLockStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if currently locked out
        const isLockedOut = user.coupleLock.lockoutUntil && 
            new Date() < new Date(user.coupleLock.lockoutUntil);

        res.json({
            success: true,
            lockStatus: {
                enabled: user.coupleLock.enabled,
                type: user.coupleLock.type,
                biometricEnabled: user.coupleLock.biometricEnabled,
                autoLockTimeout: user.coupleLock.autoLockTimeout,
                hasRecoveryQuestion: !!user.coupleLock.recoveryQuestion,
                isLockedOut,
                lockoutUntil: isLockedOut ? user.coupleLock.lockoutUntil : null,
                failedAttempts: user.coupleLock.failedAttempts
            }
        });
    } catch (error) {
        console.error('Get lock status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get lock status'
        });
    }
};

// ===========================================
// Setup PIN Lock
// ===========================================
exports.setupPinLock = async (req, res) => {
    try {
        const { pin, recoveryQuestion, recoveryAnswer } = req.body;

        // Validate PIN
        if (!pin || pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `PIN must be ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits`
            });
        }

        if (!/^\d+$/.test(pin)) {
            return res.status(400).json({
                success: false,
                message: 'PIN must contain only numbers'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash the PIN
        const salt = await bcrypt.genSalt(10);
        const pinHash = await bcrypt.hash(pin, salt);

        // Update user with lock settings
        user.coupleLock.enabled = true;
        user.coupleLock.type = 'pin';
        user.coupleLock.pinHash = pinHash;
        user.coupleLock.patternHash = null;
        user.coupleLock.failedAttempts = 0;
        user.coupleLock.lockoutUntil = null;

        // Set recovery question if provided
        if (recoveryQuestion && recoveryAnswer) {
            user.coupleLock.recoveryQuestion = recoveryQuestion;
            const answerHash = await bcrypt.hash(recoveryAnswer.toLowerCase().trim(), salt);
            user.coupleLock.recoveryAnswerHash = answerHash;
        }

        await user.save();

        res.json({
            success: true,
            message: 'PIN lock enabled successfully',
            lockType: 'pin'
        });
    } catch (error) {
        console.error('Setup PIN lock error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup PIN lock'
        });
    }
};

// ===========================================
// Setup Pattern Lock
// ===========================================
exports.setupPatternLock = async (req, res) => {
    try {
        const { pattern, recoveryQuestion, recoveryAnswer } = req.body;

        // Validate pattern (array of indices 0-8)
        if (!pattern || !Array.isArray(pattern) || pattern.length < MIN_PATTERN_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Pattern must connect at least ${MIN_PATTERN_LENGTH} dots`
            });
        }

        // Validate pattern indices
        const validIndices = pattern.every(idx => 
            Number.isInteger(idx) && idx >= 0 && idx <= 8
        );
        if (!validIndices) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pattern'
            });
        }

        // Check for duplicates
        const uniqueIndices = new Set(pattern);
        if (uniqueIndices.size !== pattern.length) {
            return res.status(400).json({
                success: false,
                message: 'Pattern cannot contain duplicate dots'
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash the pattern (convert to string first)
        const patternString = pattern.join('-');
        const salt = await bcrypt.genSalt(10);
        const patternHash = await bcrypt.hash(patternString, salt);

        // Update user with lock settings
        user.coupleLock.enabled = true;
        user.coupleLock.type = 'pattern';
        user.coupleLock.patternHash = patternHash;
        user.coupleLock.pinHash = null;
        user.coupleLock.failedAttempts = 0;
        user.coupleLock.lockoutUntil = null;

        // Set recovery question if provided
        if (recoveryQuestion && recoveryAnswer) {
            user.coupleLock.recoveryQuestion = recoveryQuestion;
            const answerHash = await bcrypt.hash(recoveryAnswer.toLowerCase().trim(), salt);
            user.coupleLock.recoveryAnswerHash = answerHash;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Pattern lock enabled successfully',
            lockType: 'pattern'
        });
    } catch (error) {
        console.error('Setup pattern lock error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup pattern lock'
        });
    }
};

// ===========================================
// Enable Biometric Lock
// ===========================================
exports.enableBiometric = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Enable biometric (device handles actual authentication)
        user.coupleLock.enabled = true;
        user.coupleLock.type = 'biometric';
        user.coupleLock.biometricEnabled = true;
        user.coupleLock.failedAttempts = 0;
        user.coupleLock.lockoutUntil = null;

        await user.save();

        res.json({
            success: true,
            message: 'Biometric lock enabled successfully',
            lockType: 'biometric'
        });
    } catch (error) {
        console.error('Enable biometric error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enable biometric lock'
        });
    }
};

// ===========================================
// Verify PIN
// ===========================================
exports.verifyPin = async (req, res) => {
    try {
        const { pin } = req.body;

        if (!pin) {
            return res.status(400).json({
                success: false,
                message: 'PIN is required'
            });
        }

        // Get user with pinHash
        const user = await User.findById(req.user._id).select('+coupleLock.pinHash');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if locked out
        if (user.coupleLock.lockoutUntil && new Date() < new Date(user.coupleLock.lockoutUntil)) {
            const remainingMinutes = Math.ceil(
                (new Date(user.coupleLock.lockoutUntil) - new Date()) / 60000
            );
            return res.status(423).json({
                success: false,
                message: `Too many failed attempts. Try again in ${remainingMinutes} minutes`,
                isLockedOut: true,
                lockoutUntil: user.coupleLock.lockoutUntil
            });
        }

        // Verify PIN
        const isMatch = await bcrypt.compare(pin, user.coupleLock.pinHash);

        if (!isMatch) {
            // Increment failed attempts
            user.coupleLock.failedAttempts += 1;

            // Check if should lockout
            if (user.coupleLock.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                user.coupleLock.lockoutUntil = new Date(
                    Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
                );
            }

            await user.save();

            const attemptsRemaining = MAX_FAILED_ATTEMPTS - user.coupleLock.failedAttempts;
            return res.status(401).json({
                success: false,
                message: attemptsRemaining > 0 
                    ? `Incorrect PIN. ${attemptsRemaining} attempts remaining`
                    : `Too many failed attempts. Locked for ${LOCKOUT_DURATION_MINUTES} minutes`,
                attemptsRemaining,
                isLockedOut: attemptsRemaining <= 0
            });
        }

        // Reset failed attempts on success
        user.coupleLock.failedAttempts = 0;
        user.coupleLock.lockoutUntil = null;
        user.coupleLock.lastUnlocked = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'PIN verified successfully',
            lastUnlocked: user.coupleLock.lastUnlocked
        });
    } catch (error) {
        console.error('Verify PIN error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify PIN'
        });
    }
};

// ===========================================
// Verify Pattern
// ===========================================
exports.verifyPattern = async (req, res) => {
    try {
        const { pattern } = req.body;

        if (!pattern || !Array.isArray(pattern)) {
            return res.status(400).json({
                success: false,
                message: 'Pattern is required'
            });
        }

        // Get user with patternHash
        const user = await User.findById(req.user._id).select('+coupleLock.patternHash');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if locked out
        if (user.coupleLock.lockoutUntil && new Date() < new Date(user.coupleLock.lockoutUntil)) {
            const remainingMinutes = Math.ceil(
                (new Date(user.coupleLock.lockoutUntil) - new Date()) / 60000
            );
            return res.status(423).json({
                success: false,
                message: `Too many failed attempts. Try again in ${remainingMinutes} minutes`,
                isLockedOut: true,
                lockoutUntil: user.coupleLock.lockoutUntil
            });
        }

        // Verify pattern
        const patternString = pattern.join('-');
        const isMatch = await bcrypt.compare(patternString, user.coupleLock.patternHash);

        if (!isMatch) {
            // Increment failed attempts
            user.coupleLock.failedAttempts += 1;

            // Check if should lockout
            if (user.coupleLock.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                user.coupleLock.lockoutUntil = new Date(
                    Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
                );
            }

            await user.save();

            const attemptsRemaining = MAX_FAILED_ATTEMPTS - user.coupleLock.failedAttempts;
            return res.status(401).json({
                success: false,
                message: attemptsRemaining > 0 
                    ? `Incorrect pattern. ${attemptsRemaining} attempts remaining`
                    : `Too many failed attempts. Locked for ${LOCKOUT_DURATION_MINUTES} minutes`,
                attemptsRemaining,
                isLockedOut: attemptsRemaining <= 0
            });
        }

        // Reset failed attempts on success
        user.coupleLock.failedAttempts = 0;
        user.coupleLock.lockoutUntil = null;
        user.coupleLock.lastUnlocked = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'Pattern verified successfully',
            lastUnlocked: user.coupleLock.lastUnlocked
        });
    } catch (error) {
        console.error('Verify pattern error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify pattern'
        });
    }
};

// ===========================================
// Verify Biometric (just confirms unlock)
// ===========================================
exports.verifyBiometric = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.coupleLock.biometricEnabled) {
            return res.status(400).json({
                success: false,
                message: 'Biometric not enabled'
            });
        }

        // Update last unlocked (actual biometric verification happens on device)
        user.coupleLock.lastUnlocked = new Date();
        user.coupleLock.failedAttempts = 0;
        await user.save();

        res.json({
            success: true,
            message: 'Biometric verified successfully',
            lastUnlocked: user.coupleLock.lastUnlocked
        });
    } catch (error) {
        console.error('Verify biometric error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify biometric'
        });
    }
};

// ===========================================
// Update Lock Settings
// ===========================================
exports.updateLockSettings = async (req, res) => {
    try {
        const { autoLockTimeout, biometricEnabled } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (autoLockTimeout !== undefined) {
            if (autoLockTimeout < 0 || autoLockTimeout > 60) {
                return res.status(400).json({
                    success: false,
                    message: 'Auto-lock timeout must be 0-60 minutes'
                });
            }
            user.coupleLock.autoLockTimeout = autoLockTimeout;
        }

        if (biometricEnabled !== undefined) {
            user.coupleLock.biometricEnabled = biometricEnabled;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Lock settings updated',
            settings: {
                autoLockTimeout: user.coupleLock.autoLockTimeout,
                biometricEnabled: user.coupleLock.biometricEnabled
            }
        });
    } catch (error) {
        console.error('Update lock settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update lock settings'
        });
    }
};

// ===========================================
// Disable Lock
// ===========================================
exports.disableLock = async (req, res) => {
    try {
        const { pin, pattern } = req.body;

        // Get user with hashes for verification
        const user = await User.findById(req.user._id)
            .select('+coupleLock.pinHash +coupleLock.patternHash');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current lock before disabling
        if (user.coupleLock.type === 'pin' && user.coupleLock.pinHash) {
            if (!pin) {
                return res.status(400).json({
                    success: false,
                    message: 'Current PIN required to disable lock'
                });
            }
            const isMatch = await bcrypt.compare(pin, user.coupleLock.pinHash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Incorrect PIN'
                });
            }
        } else if (user.coupleLock.type === 'pattern' && user.coupleLock.patternHash) {
            if (!pattern || !Array.isArray(pattern)) {
                return res.status(400).json({
                    success: false,
                    message: 'Current pattern required to disable lock'
                });
            }
            const patternString = pattern.join('-');
            const isMatch = await bcrypt.compare(patternString, user.coupleLock.patternHash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Incorrect pattern'
                });
            }
        }

        // Reset all lock settings
        user.coupleLock.enabled = false;
        user.coupleLock.type = 'none';
        user.coupleLock.pinHash = null;
        user.coupleLock.patternHash = null;
        user.coupleLock.biometricEnabled = false;
        user.coupleLock.failedAttempts = 0;
        user.coupleLock.lockoutUntil = null;

        await user.save();

        res.json({
            success: true,
            message: 'Lock disabled successfully'
        });
    } catch (error) {
        console.error('Disable lock error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disable lock'
        });
    }
};

// ===========================================
// Recovery - Verify Answer
// ===========================================
exports.verifyRecovery = async (req, res) => {
    try {
        const { answer } = req.body;

        if (!answer) {
            return res.status(400).json({
                success: false,
                message: 'Recovery answer required'
            });
        }

        // Get user with recovery answer hash
        const user = await User.findById(req.user._id)
            .select('+coupleLock.recoveryAnswerHash');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.coupleLock.recoveryAnswerHash) {
            return res.status(400).json({
                success: false,
                message: 'No recovery question set'
            });
        }

        // Verify answer
        const isMatch = await bcrypt.compare(
            answer.toLowerCase().trim(), 
            user.coupleLock.recoveryAnswerHash
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect answer'
            });
        }

        // Reset failed attempts and lockout
        user.coupleLock.failedAttempts = 0;
        user.coupleLock.lockoutUntil = null;
        user.coupleLock.lastUnlocked = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'Recovery successful. You can now reset your lock.',
            allowReset: true
        });
    } catch (error) {
        console.error('Verify recovery error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify recovery answer'
        });
    }
};

// ===========================================
// Get Recovery Question
// ===========================================
exports.getRecoveryQuestion = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.coupleLock.recoveryQuestion) {
            return res.status(404).json({
                success: false,
                message: 'No recovery question set'
            });
        }

        res.json({
            success: true,
            question: user.coupleLock.recoveryQuestion
        });
    } catch (error) {
        console.error('Get recovery question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recovery question'
        });
    }
};

// ===========================================
// Change PIN
// ===========================================
exports.changePin = async (req, res) => {
    try {
        const { currentPin, newPin } = req.body;

        // Validate new PIN
        if (!newPin || newPin.length < MIN_PIN_LENGTH || newPin.length > MAX_PIN_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `PIN must be ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits`
            });
        }

        if (!/^\d+$/.test(newPin)) {
            return res.status(400).json({
                success: false,
                message: 'PIN must contain only numbers'
            });
        }

        // Get user with current pin hash
        const user = await User.findById(req.user._id).select('+coupleLock.pinHash');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current PIN
        if (user.coupleLock.pinHash) {
            if (!currentPin) {
                return res.status(400).json({
                    success: false,
                    message: 'Current PIN required'
                });
            }
            const isMatch = await bcrypt.compare(currentPin, user.coupleLock.pinHash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Current PIN is incorrect'
                });
            }
        }

        // Hash new PIN
        const salt = await bcrypt.genSalt(10);
        user.coupleLock.pinHash = await bcrypt.hash(newPin, salt);
        await user.save();

        res.json({
            success: true,
            message: 'PIN changed successfully'
        });
    } catch (error) {
        console.error('Change PIN error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change PIN'
        });
    }
};

// ===========================================
// Change Pattern
// ===========================================
exports.changePattern = async (req, res) => {
    try {
        const { currentPattern, newPattern } = req.body;

        // Validate new pattern
        if (!newPattern || !Array.isArray(newPattern) || newPattern.length < MIN_PATTERN_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Pattern must connect at least ${MIN_PATTERN_LENGTH} dots`
            });
        }

        // Get user with current pattern hash
        const user = await User.findById(req.user._id).select('+coupleLock.patternHash');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current pattern
        if (user.coupleLock.patternHash) {
            if (!currentPattern || !Array.isArray(currentPattern)) {
                return res.status(400).json({
                    success: false,
                    message: 'Current pattern required'
                });
            }
            const currentPatternString = currentPattern.join('-');
            const isMatch = await bcrypt.compare(currentPatternString, user.coupleLock.patternHash);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Current pattern is incorrect'
                });
            }
        }

        // Hash new pattern
        const newPatternString = newPattern.join('-');
        const salt = await bcrypt.genSalt(10);
        user.coupleLock.patternHash = await bcrypt.hash(newPatternString, salt);
        await user.save();

        res.json({
            success: true,
            message: 'Pattern changed successfully'
        });
    } catch (error) {
        console.error('Change pattern error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change pattern'
        });
    }
};
