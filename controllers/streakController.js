// ===========================================
// Streak Controller
// Handles couple streak tracking and management
// ===========================================

const Couple = require('../models/Couple');

// ===========================================
// Get Streak Data
// ===========================================

const getStreakData = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Check if streak needs to be reset (missed a day)
        await checkAndUpdateStreak(couple);

        res.json({
            success: true,
            data: {
                currentStreak: couple.currentStreak,
                longestStreak: couple.longestStreak,
                lastInteractionDate: couple.lastInteractionDate,
                todayInteractions: couple.todayInteractions,
                streakMilestones: couple.streakMilestones,
                streakLevel: getStreakLevel(couple.currentStreak)
            }
        });

    } catch (error) {
        console.error('Get streak error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get streak data'
        });
    }
};

// ===========================================
// Record Interaction (called internally)
// ===========================================

const recordInteraction = async (coupleId, interactionType) => {
    try {
        const couple = await Couple.findById(coupleId);
        if (!couple) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastInteraction = couple.lastInteractionDate 
            ? new Date(couple.lastInteractionDate) 
            : null;
        
        if (lastInteraction) {
            lastInteraction.setHours(0, 0, 0, 0);
        }

        // Check if this is a new day
        const isNewDay = !lastInteraction || lastInteraction.getTime() !== today.getTime();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (isNewDay) {
            // Reset today's interactions for new day
            couple.todayInteractions = {
                chat: false,
                call: false,
                activity: false
            };

            // Check if streak should continue or reset
            if (lastInteraction) {
                const daysDiff = Math.floor((today - lastInteraction) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === 1) {
                    // Continue streak - interacted yesterday
                    couple.currentStreak += 1;
                } else if (daysDiff > 1) {
                    // Streak broken - missed days
                    couple.currentStreak = 1;
                }
            } else {
                // First interaction ever
                couple.currentStreak = 1;
            }

            // Update longest streak if current is higher
            if (couple.currentStreak > couple.longestStreak) {
                couple.longestStreak = couple.currentStreak;
            }

            // Check for milestone achievements
            const milestones = [7, 14, 30, 50, 100, 200, 365];
            for (const milestone of milestones) {
                if (couple.currentStreak === milestone) {
                    const alreadyAchieved = couple.streakMilestones.some(
                        m => m.milestone === milestone
                    );
                    if (!alreadyAchieved) {
                        couple.streakMilestones.push({
                            milestone,
                            achievedAt: new Date()
                        });
                    }
                }
            }
        }

        // Record the interaction type
        if (interactionType === 'chat') {
            couple.todayInteractions.chat = true;
        } else if (interactionType === 'call') {
            couple.todayInteractions.call = true;
        } else if (interactionType === 'activity') {
            couple.todayInteractions.activity = true;
        }

        couple.lastInteractionDate = new Date();
        await couple.save();

        return {
            currentStreak: couple.currentStreak,
            longestStreak: couple.longestStreak,
            todayInteractions: couple.todayInteractions
        };

    } catch (error) {
        console.error('Record interaction error:', error);
        return null;
    }
};

// ===========================================
// Manual Interaction Recording (API endpoint)
// ===========================================

const recordManualInteraction = async (req, res) => {
    try {
        const userId = req.user._id;
        const { type } = req.body;

        if (!['chat', 'call', 'activity'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid interaction type'
            });
        }

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const result = await recordInteraction(couple._id, type);

        if (!result) {
            return res.status(500).json({
                success: false,
                message: 'Failed to record interaction'
            });
        }

        res.json({
            success: true,
            data: {
                ...result,
                streakLevel: getStreakLevel(result.currentStreak)
            }
        });

    } catch (error) {
        console.error('Record manual interaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record interaction'
        });
    }
};

// ===========================================
// Check and update streak (for missed days)
// ===========================================

const checkAndUpdateStreak = async (couple) => {
    if (!couple.lastInteractionDate) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastInteraction = new Date(couple.lastInteractionDate);
    lastInteraction.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today - lastInteraction) / (1000 * 60 * 60 * 24));

    // If more than 1 day has passed without interaction, reset streak
    if (daysDiff > 1) {
        couple.currentStreak = 0;
        couple.todayInteractions = {
            chat: false,
            call: false,
            activity: false
        };
        await couple.save();
    }
};

// ===========================================
// Get Streak Level
// ===========================================

const getStreakLevel = (streak) => {
    if (streak >= 365) return { level: 'legendary', icon: '👑', title: 'Legendary Lovers' };
    if (streak >= 200) return { level: 'eternal', icon: '💫', title: 'Eternal Flame' };
    if (streak >= 100) return { level: 'blazing', icon: '🔥', title: 'Blazing Hearts' };
    if (streak >= 50) return { level: 'passionate', icon: '❤️‍🔥', title: 'Passionate Pair' };
    if (streak >= 30) return { level: 'dedicated', icon: '💖', title: 'Dedicated Duo' };
    if (streak >= 14) return { level: 'devoted', icon: '💕', title: 'Devoted Hearts' };
    if (streak >= 7) return { level: 'connected', icon: '💝', title: 'Connected Couple' };
    if (streak >= 3) return { level: 'warming', icon: '🧡', title: 'Warming Up' };
    if (streak >= 1) return { level: 'starting', icon: '💛', title: 'Just Starting' };
    return { level: 'none', icon: '🤍', title: 'Start Your Streak!' };
};

// ===========================================
// Get Streak Milestones
// ===========================================

const getMilestones = async (req, res) => {
    try {
        const userId = req.user._id;

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const allMilestones = [
            { milestone: 7, title: '1 Week', icon: '🌟' },
            { milestone: 14, title: '2 Weeks', icon: '✨' },
            { milestone: 30, title: '1 Month', icon: '🌙' },
            { milestone: 50, title: '50 Days', icon: '🔥' },
            { milestone: 100, title: '100 Days', icon: '💯' },
            { milestone: 200, title: '200 Days', icon: '🏆' },
            { milestone: 365, title: '1 Year', icon: '👑' }
        ];

        const milestonesWithStatus = allMilestones.map(m => {
            const achieved = couple.streakMilestones.find(
                sm => sm.milestone === m.milestone
            );
            return {
                ...m,
                achieved: !!achieved,
                achievedAt: achieved?.achievedAt || null
            };
        });

        res.json({
            success: true,
            data: {
                milestones: milestonesWithStatus,
                currentStreak: couple.currentStreak,
                longestStreak: couple.longestStreak
            }
        });

    } catch (error) {
        console.error('Get milestones error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get milestones'
        });
    }
};

// ===========================================
// Get Miss You Alert Status
// ===========================================

const getMissYouAlertStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const parsedHours = Number(req.query.hours);
        const defaultHours = Number(process.env.MISS_YOU_ALERT_HOURS) || 24;
        const thresholdHours = Number.isFinite(parsedHours) && parsedHours > 0
            ? parsedHours
            : defaultHours;

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        });

        if (!couple) {
            return res.status(200).json({
                success: true,
                data: {
                    shouldShow: false,
                    message: '',
                    thresholdHours,
                    hoursSinceLastInteraction: null,
                    lastInteractionDate: null
                }
            });
        }

        const lastInteractionDate = couple.lastInteractionDate || null;
        const now = Date.now();
        const thresholdMs = thresholdHours * 60 * 60 * 1000;
        const hoursSinceLastInteraction = lastInteractionDate
            ? (now - new Date(lastInteractionDate).getTime()) / (1000 * 60 * 60)
            : null;

        const shouldShow = !lastInteractionDate || (now - new Date(lastInteractionDate).getTime()) >= thresholdMs;

        res.json({
            success: true,
            data: {
                shouldShow,
                message: shouldShow
                    ? "You haven't talked today ❤️"
                    : '',
                thresholdHours,
                hoursSinceLastInteraction,
                lastInteractionDate
            }
        });
    } catch (error) {
        console.error('Get miss you alert status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get miss you alert status'
        });
    }
};

module.exports = {
    getStreakData,
    recordInteraction,
    recordManualInteraction,
    getMilestones,
    getMissYouAlertStatus,
    checkAndUpdateStreak,
    getStreakLevel
};
