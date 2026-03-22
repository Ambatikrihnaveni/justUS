// ===========================================
// Daily Question Controller
// Handles daily couple question operations
// ===========================================

const DailyQuestion = require('../models/DailyQuestion');
const CoupleAnswer = require('../models/CoupleAnswer');
const User = require('../models/User');
const Couple = require('../models/Couple');

// ===========================================
// Get Today's Question
// GET /api/daily-question
// ===========================================

const getTodaysQuestion = async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to access daily questions'
            });
        }

        // Get the couple to verify it's complete
        const couple = await Couple.findById(user.coupleId);
        if (!couple || !couple.isComplete) {
            return res.status(400).json({
                success: false,
                message: 'Your partner needs to join first to access daily questions'
            });
        }

        // Get today's question (seed if none exist)
        let todaysQuestion = await DailyQuestion.getTodaysQuestion();
        
        if (!todaysQuestion) {
            // Seed questions if none exist
            console.log('No questions found, seeding...');
            await DailyQuestion.seedQuestions();
            todaysQuestion = await DailyQuestion.getTodaysQuestion();
            
            if (!todaysQuestion) {
                return res.status(404).json({
                    success: false,
                    message: 'No questions available'
                });
            }
        }

        // Get or create today's answer record
        const answerRecord = await CoupleAnswer.getOrCreateTodaysAnswer(
            user.coupleId,
            todaysQuestion._id
        );

        // Get status for current user
        const status = answerRecord.getStatusForUser(userId);

        // Get partner info
        const partnerId = couple.partner1.toString() === userId.toString() 
            ? couple.partner2 
            : couple.partner1;
        const partner = await User.findById(partnerId).select('name avatar');

        res.status(200).json({
            success: true,
            data: {
                question: {
                    _id: todaysQuestion._id,
                    text: todaysQuestion.question,
                    category: todaysQuestion.category,
                    dayNumber: todaysQuestion.dayNumber
                },
                answerId: answerRecord._id,
                status: {
                    userAnswered: status.userAnswered,
                    partnerAnswered: status.partnerAnswered,
                    bothAnswered: status.bothAnswered,
                    userAnswer: status.userAnswer ? {
                        text: status.userAnswer.text,
                        answeredAt: status.userAnswer.answeredAt
                    } : null,
                    partnerAnswer: status.partnerAnswer ? {
                        text: status.partnerAnswer.text,
                        answeredAt: status.partnerAnswer.answeredAt,
                        partnerName: partner?.name || 'Partner'
                    } : null,
                    revealedAt: status.revealedAt
                },
                partner: {
                    _id: partner?._id,
                    name: partner?.name,
                    avatar: partner?.avatar
                }
            }
        });

    } catch (error) {
        console.error('Get today\'s question error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching daily question'
        });
    }
};

// ===========================================
// Submit Answer
// POST /api/daily-question/answer
// ===========================================

const submitAnswer = async (req, res) => {
    try {
        const userId = req.user._id;
        const { answerId, answer } = req.body;

        // Validate input
        if (!answerId || !answer || !answer.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Answer is required'
            });
        }

        if (answer.length > 1000) {
            return res.status(400).json({
                success: false,
                message: 'Answer cannot exceed 1000 characters'
            });
        }

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to answer'
            });
        }

        // Get the answer record
        const answerRecord = await CoupleAnswer.findById(answerId);
        
        if (!answerRecord) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        // Verify couple ownership
        if (answerRecord.coupleId.toString() !== user.coupleId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only answer questions for your couple'
            });
        }

        // Submit the answer
        try {
            await answerRecord.submitAnswer(userId, answer.trim());
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        // Get updated status
        const updatedRecord = await CoupleAnswer.findById(answerId).populate('questionId');
        const status = updatedRecord.getStatusForUser(userId);

        // Get partner info if both answered
        let partnerName = 'Partner';
        if (status.bothAnswered) {
            const couple = await Couple.findById(user.coupleId);
            const partnerId = couple.partner1.toString() === userId.toString() 
                ? couple.partner2 
                : couple.partner1;
            const partner = await User.findById(partnerId).select('name');
            partnerName = partner?.name || 'Partner';
        }

        // Emit socket event if both answered (for real-time reveal)
        if (status.bothAnswered) {
            const io = req.app.get('io');
            if (io) {
                const couple = await Couple.findById(user.coupleId);
                const partnerId = couple.partner1.toString() === userId.toString() 
                    ? couple.partner2 
                    : couple.partner1;
                
                io.to(partnerId.toString()).emit('dailyQuestionAnswered', {
                    answerId: answerRecord._id,
                    bothAnswered: true
                });
            }
        }

        res.status(200).json({
            success: true,
            message: status.bothAnswered 
                ? 'Both answers revealed!' 
                : 'Answer submitted! Waiting for your partner.',
            data: {
                status: {
                    userAnswered: status.userAnswered,
                    partnerAnswered: status.partnerAnswered,
                    bothAnswered: status.bothAnswered,
                    userAnswer: status.userAnswer ? {
                        text: status.userAnswer.text,
                        answeredAt: status.userAnswer.answeredAt
                    } : null,
                    partnerAnswer: status.partnerAnswer ? {
                        text: status.partnerAnswer.text,
                        answeredAt: status.partnerAnswer.answeredAt,
                        partnerName
                    } : null,
                    revealedAt: status.revealedAt
                }
            }
        });

    } catch (error) {
        console.error('Submit answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting answer'
        });
    }
};

// ===========================================
// Get Answer History
// GET /api/daily-question/history
// ===========================================

const getAnswerHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10 } = req.query;

        // Get user's couple
        const user = await User.findById(userId);
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to view history'
            });
        }

        // Get completed answers for this couple
        const answers = await CoupleAnswer.find({
            coupleId: user.coupleId,
            isComplete: true
        })
        .populate('questionId', 'question category')
        .sort({ questionDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

        // Get total count
        const total = await CoupleAnswer.countDocuments({
            coupleId: user.coupleId,
            isComplete: true
        });

        // Get partner info
        const couple = await Couple.findById(user.coupleId);
        const partnerId = couple.partner1.toString() === userId.toString() 
            ? couple.partner2 
            : couple.partner1;
        const partner = await User.findById(partnerId).select('name avatar');

        // Format answers with user/partner distinction
        const formattedAnswers = answers.map(answer => {
            const status = answer.getStatusForUser(userId);
            return {
                _id: answer._id,
                question: answer.questionId?.question || 'Question unavailable',
                category: answer.questionId?.category,
                questionDate: answer.questionDate,
                userAnswer: status.userAnswer?.text,
                partnerAnswer: status.partnerAnswer?.text,
                partnerName: partner?.name || 'Partner',
                revealedAt: answer.revealedAt
            };
        });

        res.status(200).json({
            success: true,
            data: {
                answers: formattedAnswers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get answer history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching history'
        });
    }
};

// ===========================================
// Seed Questions (Admin endpoint)
// POST /api/daily-question/seed
// ===========================================

const seedQuestions = async (req, res) => {
    try {
        const result = await DailyQuestion.seedQuestions();
        
        res.status(200).json({
            success: true,
            message: result.message,
            count: result.count
        });

    } catch (error) {
        console.error('Seed questions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error seeding questions'
        });
    }
};

module.exports = {
    getTodaysQuestion,
    submitAnswer,
    getAnswerHistory,
    seedQuestions
};
