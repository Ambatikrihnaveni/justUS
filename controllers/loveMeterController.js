// ===========================================
// Love Meter Controller
// Calculates relationship score based on activity
// ===========================================

const Message = require('../models/Message');
const Call = require('../models/Call');
const SavedMessage = require('../models/SavedMessage');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Score Configuration
// ===========================================

const SCORE_CONFIG = {
    // Points per activity
    points: {
        message: 1,
        photoMessage: 3,
        voiceMessage: 2,
        videoMessage: 4,
        gifMessage: 1,
        call: 5,
        videoCall: 8,
        savedMemory: 10
    },
    // Score milestones
    milestones: [
        { score: 0, level: 1, title: 'Just Starting', emoji: '💕', color: '#ffcdd2' },
        { score: 100, level: 2, title: 'Getting Closer', emoji: '💗', color: '#f8bbd9' },
        { score: 250, level: 3, title: 'Warming Up', emoji: '💖', color: '#f48fb1' },
        { score: 500, level: 4, title: 'In Sync', emoji: '💝', color: '#ec407a' },
        { score: 1000, level: 5, title: 'Connected', emoji: '💞', color: '#e91e63' },
        { score: 2000, level: 6, title: 'Inseparable', emoji: '💓', color: '#d81b60' },
        { score: 3500, level: 7, title: 'Soulmates', emoji: '💘', color: '#c2185b' },
        { score: 5000, level: 8, title: 'True Love', emoji: '❤️‍🔥', color: '#ad1457' },
        { score: 7500, level: 9, title: 'Legendary', emoji: '💎', color: '#880e4f' },
        { score: 10000, level: 10, title: 'Eternal Love', emoji: '👑', color: '#4a0072' }
    ],
    // Max score for percentage calculation
    maxDisplayScore: 10000
};

// ===========================================
// Helper: Get user's couple
// ===========================================

const getUserCouple = async (userId) => {
    const user = await User.findById(userId);
    if (!user || !user.coupleId) return null;
    
    const couple = await Couple.findById(user.coupleId);
    if (!couple || !couple.isComplete) return null;
    
    const partnerId = couple.partner1.toString() === userId.toString()
        ? couple.partner2
        : couple.partner1;
    
    return { user, couple, partnerId };
};

// ===========================================
// Helper: Get current milestone
// ===========================================

const getMilestone = (score) => {
    let current = SCORE_CONFIG.milestones[0];
    let next = SCORE_CONFIG.milestones[1];
    
    for (let i = SCORE_CONFIG.milestones.length - 1; i >= 0; i--) {
        if (score >= SCORE_CONFIG.milestones[i].score) {
            current = SCORE_CONFIG.milestones[i];
            next = SCORE_CONFIG.milestones[i + 1] || null;
            break;
        }
    }
    
    return { current, next };
};

// ===========================================
// Get Love Meter Score
// GET /api/love-meter
// ===========================================

const getLoveMeterScore = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const data = await getUserCouple(userId);
        if (!data) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a complete couple to view Love Meter'
            });
        }

        const { couple, partnerId } = data;
        const coupleId = couple._id;
        const partner1 = couple.partner1;
        const partner2 = couple.partner2;

        // Count messages between the couple
        const messageStats = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { senderId: partner1, receiverId: partner2 },
                        { senderId: partner2, receiverId: partner1 }
                    ]
                }
            },
            {
                $group: {
                    _id: '$messageType',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Process message stats
        let messageScore = 0;
        const messageCounts = { total: 0, photos: 0, voice: 0, video: 0, gif: 0, text: 0 };
        
        messageStats.forEach(stat => {
            messageCounts.total += stat.count;
            switch (stat._id) {
                case 'image':
                    messageCounts.photos = stat.count;
                    messageScore += stat.count * SCORE_CONFIG.points.photoMessage;
                    break;
                case 'voice':
                    messageCounts.voice = stat.count;
                    messageScore += stat.count * SCORE_CONFIG.points.voiceMessage;
                    break;
                case 'video':
                    messageCounts.video = stat.count;
                    messageScore += stat.count * SCORE_CONFIG.points.videoMessage;
                    break;
                case 'gif':
                    messageCounts.gif = stat.count;
                    messageScore += stat.count * SCORE_CONFIG.points.gifMessage;
                    break;
                default:
                    messageCounts.text = stat.count;
                    messageScore += stat.count * SCORE_CONFIG.points.message;
            }
        });

        // Count calls
        const callStats = await Call.aggregate([
            {
                $match: {
                    $or: [
                        { callerId: partner1, receiverId: partner2, status: 'ended' },
                        { callerId: partner2, receiverId: partner1, status: 'ended' }
                    ]
                }
            },
            {
                $group: {
                    _id: '$callType',
                    count: { $sum: 1 },
                    totalDuration: { $sum: '$duration' }
                }
            }
        ]);

        // Process call stats
        let callScore = 0;
        const callCounts = { total: 0, voice: 0, video: 0, totalMinutes: 0 };
        
        callStats.forEach(stat => {
            callCounts.total += stat.count;
            callCounts.totalMinutes += Math.round((stat.totalDuration || 0) / 60);
            if (stat._id === 'video') {
                callCounts.video = stat.count;
                callScore += stat.count * SCORE_CONFIG.points.videoCall;
            } else {
                callCounts.voice = stat.count;
                callScore += stat.count * SCORE_CONFIG.points.call;
            }
        });

        // Count saved memories
        const memoriesCount = await SavedMessage.countDocuments({
            coupleId: coupleId
        });
        const memoriesScore = memoriesCount * SCORE_CONFIG.points.savedMemory;

        // Calculate total score
        const totalScore = messageScore + callScore + memoriesScore;
        
        // Get milestone info
        const { current: currentMilestone, next: nextMilestone } = getMilestone(totalScore);
        
        // Calculate progress to next milestone
        let progressToNext = 100;
        if (nextMilestone) {
            const pointsInCurrentLevel = totalScore - currentMilestone.score;
            const pointsNeededForNext = nextMilestone.score - currentMilestone.score;
            progressToNext = Math.min(100, Math.round((pointsInCurrentLevel / pointsNeededForNext) * 100));
        }

        // Calculate overall percentage (capped at 100%)
        const overallPercentage = Math.min(100, Math.round((totalScore / SCORE_CONFIG.maxDisplayScore) * 100));

        // Get couple start date for "days together"
        const daysTogether = Math.floor((new Date() - new Date(couple.createdAt)) / (1000 * 60 * 60 * 24));

        res.json({
            success: true,
            loveMeter: {
                totalScore,
                overallPercentage,
                daysTogether,
                
                // Current milestone
                level: currentMilestone.level,
                title: currentMilestone.title,
                emoji: currentMilestone.emoji,
                color: currentMilestone.color,
                
                // Progress to next level
                nextLevel: nextMilestone ? {
                    level: nextMilestone.level,
                    title: nextMilestone.title,
                    scoreNeeded: nextMilestone.score,
                    progressPercent: progressToNext
                } : null,
                
                // Activity breakdown
                breakdown: {
                    messages: {
                        count: messageCounts.total,
                        score: messageScore,
                        details: {
                            text: messageCounts.text,
                            photos: messageCounts.photos,
                            voice: messageCounts.voice,
                            video: messageCounts.video,
                            gif: messageCounts.gif
                        }
                    },
                    calls: {
                        count: callCounts.total,
                        score: callScore,
                        details: {
                            voice: callCounts.voice,
                            video: callCounts.video,
                            totalMinutes: callCounts.totalMinutes
                        }
                    },
                    memories: {
                        count: memoriesCount,
                        score: memoriesScore
                    }
                },
                
                // All milestones for display
                milestones: SCORE_CONFIG.milestones
            }
        });

    } catch (error) {
        console.error('Get love meter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate Love Meter'
        });
    }
};

// ===========================================
// Get Milestones List
// GET /api/love-meter/milestones
// ===========================================

const getMilestones = async (req, res) => {
    res.json({
        success: true,
        milestones: SCORE_CONFIG.milestones,
        pointsConfig: SCORE_CONFIG.points
    });
};

module.exports = {
    getLoveMeterScore,
    getMilestones
};
