// ===========================================
// Love Letter Controller
// Handles secret love letter operations
// ===========================================

const LoveLetter = require('../models/LoveLetter');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Helper: Verify user belongs to couple
// ===========================================

const verifyCoupleMember = async (userId, coupleId) => {
    const couple = await Couple.findById(coupleId);
    if (!couple) return false;
    
    return couple.partner1.toString() === userId.toString() ||
           couple.partner2?.toString() === userId.toString();
};

// ===========================================
// Get All Letters (for current user)
// GET /api/love-letters
// ===========================================

const getLetters = async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to access love letters'
            });
        }

        // Verify couple is complete
        const couple = await Couple.findById(user.coupleId);
        if (!couple || !couple.isComplete) {
            return res.status(400).json({
                success: false,
                message: 'Your partner needs to join first'
            });
        }

        // Get letters sent TO this user and BY this user
        const receivedLetters = await LoveLetter.find({
            coupleId: user.coupleId,
            recipientId: userId
        })
        .populate('senderId', 'name profilePicture')
        .sort({ unlockDate: 1 });

        const sentLetters = await LoveLetter.find({
            coupleId: user.coupleId,
            senderId: userId
        })
        .populate('recipientId', 'name profilePicture')
        .sort({ unlockDate: 1 });

        // Process received letters - hide content if locked
        const processedReceived = receivedLetters.map(letter => {
            const letterObj = letter.toObject();
            const isUnlocked = new Date() >= new Date(letter.unlockDate);
            
            if (!isUnlocked) {
                // Hide content for locked letters
                return {
                    ...letterObj,
                    content: null,
                    isUnlocked: false,
                    countdown: letter.getCountdown()
                };
            }
            
            return {
                ...letterObj,
                isUnlocked: true,
                countdown: letter.getCountdown()
            };
        });

        res.json({
            success: true,
            received: processedReceived,
            sent: sentLetters.map(l => ({
                ...l.toObject(),
                isUnlocked: new Date() >= new Date(l.unlockDate),
                countdown: l.getCountdown()
            }))
        });

    } catch (error) {
        console.error('Get letters error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch love letters'
        });
    }
};

// ===========================================
// Get Single Letter
// GET /api/love-letters/:letterId
// ===========================================

const getLetter = async (req, res) => {
    try {
        const userId = req.user._id;
        const { letterId } = req.params;

        const letter = await LoveLetter.findById(letterId)
            .populate('senderId', 'name profilePicture')
            .populate('recipientId', 'name profilePicture');

        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        // Verify user has access
        const user = await User.findById(userId);
        if (!user || user.coupleId.toString() !== letter.coupleId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this letter'
            });
        }

        const isUnlocked = new Date() >= new Date(letter.unlockDate);
        const isRecipient = letter.recipientId._id.toString() === userId.toString();
        const isSender = letter.senderId._id.toString() === userId.toString();

        // If locked and user is recipient, hide content
        if (!isUnlocked && isRecipient) {
            return res.json({
                success: true,
                letter: {
                    _id: letter._id,
                    title: letter.title,
                    senderId: letter.senderId,
                    recipientId: letter.recipientId,
                    unlockDate: letter.unlockDate,
                    occasion: letter.occasion,
                    customOccasion: letter.customOccasion,
                    theme: letter.theme,
                    content: null,
                    isUnlocked: false,
                    isOpened: letter.isOpened,
                    countdown: letter.getCountdown(),
                    createdAt: letter.createdAt
                }
            });
        }

        // If sender, they can always see what they wrote
        // If unlocked, recipient can see content
        const letterData = letter.toObject();
        
        // Mark as opened if recipient is viewing an unlocked letter
        if (isUnlocked && isRecipient && !letter.isOpened) {
            letter.isOpened = true;
            letter.openedAt = new Date();
            await letter.save();
        }

        res.json({
            success: true,
            letter: {
                ...letterData,
                isUnlocked,
                countdown: letter.getCountdown()
            }
        });

    } catch (error) {
        console.error('Get letter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch letter'
        });
    }
};

// ===========================================
// Create Love Letter
// POST /api/love-letters
// ===========================================

const createLetter = async (req, res) => {
    try {
        const userId = req.user._id;
        const { title, content, unlockDate, occasion, customOccasion, theme } = req.body;

        // Validate required fields
        if (!content || !unlockDate) {
            return res.status(400).json({
                success: false,
                message: 'Content and unlock date are required'
            });
        }

        // Validate unlock date is in the future
        const unlock = new Date(unlockDate);
        if (unlock <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Unlock date must be in the future'
            });
        }

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to send love letters'
            });
        }

        // Get the couple to find partner
        const couple = await Couple.findById(user.coupleId);
        if (!couple || !couple.isComplete) {
            return res.status(400).json({
                success: false,
                message: 'Your partner needs to join first'
            });
        }

        // Determine recipient (the partner)
        const recipientId = couple.partner1.toString() === userId.toString()
            ? couple.partner2
            : couple.partner1;

        // Create the letter
        const letter = await LoveLetter.create({
            coupleId: user.coupleId,
            senderId: userId,
            recipientId,
            title: title || 'A Secret Letter',
            content,
            unlockDate: unlock,
            occasion: occasion || 'custom',
            customOccasion,
            theme: theme || 'heart'
        });

        // Populate sender/recipient info
        await letter.populate('senderId', 'name profilePicture');
        await letter.populate('recipientId', 'name profilePicture');

        res.status(201).json({
            success: true,
            message: 'Love letter created! It will be unlocked on ' + unlock.toLocaleDateString(),
            letter: {
                ...letter.toObject(),
                isUnlocked: false,
                countdown: letter.getCountdown()
            }
        });

    } catch (error) {
        console.error('Create letter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create love letter'
        });
    }
};

// ===========================================
// Delete Letter (only sender can delete)
// DELETE /api/love-letters/:letterId
// ===========================================

const deleteLetter = async (req, res) => {
    try {
        const userId = req.user._id;
        const { letterId } = req.params;

        const letter = await LoveLetter.findById(letterId);

        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        // Only sender can delete (and only if not yet unlocked)
        if (letter.senderId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only the sender can delete a letter'
            });
        }

        // Don't allow deleting opened letters
        if (letter.isOpened) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete a letter that has been opened'
            });
        }

        await LoveLetter.findByIdAndDelete(letterId);

        res.json({
            success: true,
            message: 'Letter deleted successfully'
        });

    } catch (error) {
        console.error('Delete letter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete letter'
        });
    }
};

// ===========================================
// Get Occasion Types
// GET /api/love-letters/occasions
// ===========================================

const getOccasions = async (req, res) => {
    const occasions = [
        { value: 'birthday', label: 'Birthday 🎂', emoji: '🎂' },
        { value: 'anniversary', label: 'Anniversary 💕', emoji: '💕' },
        { value: 'valentine', label: "Valentine's Day ❤️", emoji: '❤️' },
        { value: 'christmas', label: 'Christmas 🎄', emoji: '🎄' },
        { value: 'new_year', label: 'New Year 🎆', emoji: '🎆' },
        { value: 'just_because', label: 'Just Because 💝', emoji: '💝' },
        { value: 'surprise', label: 'Surprise! 🎁', emoji: '🎁' },
        { value: 'apology', label: 'Apology 💐', emoji: '💐' },
        { value: 'thank_you', label: 'Thank You 🙏', emoji: '🙏' },
        { value: 'custom', label: 'Custom', emoji: '✨' }
    ];

    res.json({
        success: true,
        occasions
    });
};

module.exports = {
    getLetters,
    getLetter,
    createLetter,
    deleteLetter,
    getOccasions
};
