// ===========================================
// Mood Controller
// Handles mood sync feature operations
// ===========================================

const User = require('../models/User');
const Couple = require('../models/Couple');

// Mood emoji mapping
const MOOD_EMOJIS = {
    happy: '😊',
    sad: '😢',
    missing_you: '🥺',
    in_love: '😍',
    tired: '😴',
    excited: '🤩',
    angry: '😤',
    neutral: '😐'
};

// ===========================================
// Get Current Mood (both partners)
// ===========================================
const getCurrentMood = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user's couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name mood avatar');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Determine which user is which
        const isPartner1 = couple.partner1._id.toString() === userId;
        const me = isPartner1 ? couple.partner1 : couple.partner2;
        const partner = isPartner1 ? couple.partner2 : couple.partner1;

        res.json({
            success: true,
            myMood: {
                mood: me.mood?.current || 'neutral',
                status: me.mood?.status || '',
                emoji: MOOD_EMOJIS[me.mood?.current || 'neutral'],
                updatedAt: me.mood?.updatedAt
            },
            partnerMood: {
                name: partner.name,
                avatar: partner.avatar,
                mood: partner.mood?.current || 'neutral',
                status: partner.mood?.status || '',
                emoji: MOOD_EMOJIS[partner.mood?.current || 'neutral'],
                updatedAt: partner.mood?.updatedAt
            }
        });
    } catch (error) {
        console.error('Get current mood error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get mood',
            error: error.message
        });
    }
};

// ===========================================
// Set Mood
// ===========================================
const setMood = async (req, res) => {
    try {
        const userId = req.user.id;
        const { mood, status = '' } = req.body;

        // Validate mood
        const validMoods = ['happy', 'sad', 'missing_you', 'in_love', 'tired', 'excited', 'angry', 'neutral'];
        if (!mood || !validMoods.includes(mood)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mood. Must be one of: ' + validMoods.join(', ')
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Add current mood to history before updating (if exists)
        if (user.mood?.current && user.mood.current !== 'neutral') {
            user.moodHistory.unshift({
                mood: user.mood.current,
                status: user.mood.status || '',
                setAt: user.mood.updatedAt || new Date()
            });

            // Keep only last 50 mood history entries
            if (user.moodHistory.length > 50) {
                user.moodHistory = user.moodHistory.slice(0, 50);
            }
        }

        // Update current mood
        user.mood = {
            current: mood,
            status: status.trim().slice(0, 100), // Limit to 100 chars
            updatedAt: new Date()
        };

        await user.save();

        // Get partner info for socket emit
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        const partnerId = couple 
            ? (couple.partner1.toString() === userId ? couple.partner2 : couple.partner1)
            : null;

        res.json({
            success: true,
            message: 'Mood updated!',
            mood: {
                mood: user.mood.current,
                status: user.mood.status,
                emoji: MOOD_EMOJIS[user.mood.current],
                updatedAt: user.mood.updatedAt
            },
            partnerId: partnerId?.toString()
        });
    } catch (error) {
        console.error('Set mood error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set mood',
            error: error.message
        });
    }
};

// ===========================================
// Get Mood History
// ===========================================
const getMoodHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { partnerId } = req.query; // Optional: get partner's history
        const { limit = 20, page = 1 } = req.query;

        let targetUserId = userId;

        // If requesting partner's history, verify they're a couple
        if (partnerId) {
            const couple = await Couple.findOne({
                $or: [
                    { partner1: userId, partner2: partnerId },
                    { partner1: partnerId, partner2: userId }
                ]
            });

            if (!couple) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view this history'
                });
            }

            targetUserId = partnerId;
        }

        const user = await User.findById(targetUserId)
            .select('name moodHistory mood');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Add emoji to each history entry
        const historyWithEmoji = (user.moodHistory || []).map(entry => ({
            mood: entry.mood,
            status: entry.status,
            emoji: MOOD_EMOJIS[entry.mood],
            setAt: entry.setAt
        }));

        // Paginate
        const startIndex = (page - 1) * limit;
        const paginatedHistory = historyWithEmoji.slice(startIndex, startIndex + parseInt(limit));

        res.json({
            success: true,
            currentMood: {
                mood: user.mood?.current || 'neutral',
                status: user.mood?.status || '',
                emoji: MOOD_EMOJIS[user.mood?.current || 'neutral'],
                updatedAt: user.mood?.updatedAt
            },
            history: paginatedHistory,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: historyWithEmoji.length,
                hasMore: startIndex + paginatedHistory.length < historyWithEmoji.length
            }
        });
    } catch (error) {
        console.error('Get mood history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get mood history',
            error: error.message
        });
    }
};

// ===========================================
// Get Mood Stats
// ===========================================
const getMoodStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user's couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const partnerId = couple.partner1.toString() === userId 
            ? couple.partner2 
            : couple.partner1;

        // Get both users' mood histories
        const [myUser, partnerUser] = await Promise.all([
            User.findById(userId).select('moodHistory'),
            User.findById(partnerId).select('moodHistory name')
        ]);

        // Calculate mood frequency
        const calculateMoodFrequency = (history) => {
            const frequency = {};
            (history || []).forEach(entry => {
                frequency[entry.mood] = (frequency[entry.mood] || 0) + 1;
            });
            return frequency;
        };

        const myFrequency = calculateMoodFrequency(myUser.moodHistory);
        const partnerFrequency = calculateMoodFrequency(partnerUser.moodHistory);

        // Find most common moods
        const findMostCommon = (frequency) => {
            const entries = Object.entries(frequency);
            if (entries.length === 0) return null;
            const sorted = entries.sort((a, b) => b[1] - a[1]);
            return {
                mood: sorted[0][0],
                emoji: MOOD_EMOJIS[sorted[0][0]],
                count: sorted[0][1]
            };
        };

        res.json({
            success: true,
            stats: {
                myStats: {
                    totalMoodChanges: myUser.moodHistory?.length || 0,
                    mostCommonMood: findMostCommon(myFrequency),
                    moodFrequency: myFrequency
                },
                partnerStats: {
                    name: partnerUser.name,
                    totalMoodChanges: partnerUser.moodHistory?.length || 0,
                    mostCommonMood: findMostCommon(partnerFrequency),
                    moodFrequency: partnerFrequency
                }
            }
        });
    } catch (error) {
        console.error('Get mood stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get mood stats',
            error: error.message
        });
    }
};

module.exports = {
    getCurrentMood,
    setMood,
    getMoodHistory,
    getMoodStats,
    MOOD_EMOJIS
};
