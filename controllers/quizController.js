// ===========================================
// Quiz Controller
// Handles couple love quiz operations
// ===========================================

const Quiz = require('../models/Quiz');
const Couple = require('../models/Couple');
const { recordInteraction } = require('./streakController');

// ===========================================
// Get Active Quiz or Create New
// ===========================================
const getActiveQuiz = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user's couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Check for existing pending or waiting quiz
        let activeQuiz = await Quiz.findOne({
            coupleId: couple._id,
            status: { $in: ['pending', 'waiting'] }
        });

        if (activeQuiz) {
            // Determine user's role in this quiz
            const hasUserAnswered = 
                (activeQuiz.answer1.answeredBy?.toString() === userId) ||
                (activeQuiz.answer2.answeredBy?.toString() === userId);

            return res.json({
                success: true,
                quiz: {
                    id: activeQuiz._id,
                    questionId: activeQuiz.questionId,
                    question: activeQuiz.question,
                    category: activeQuiz.category,
                    status: activeQuiz.status,
                    hasUserAnswered,
                    partnerHasAnswered: activeQuiz.status === 'waiting' && !hasUserAnswered,
                    createdAt: activeQuiz.createdAt
                },
                partner: {
                    name: couple.partner1._id.toString() === userId ? couple.partner2.name : couple.partner1.name
                }
            });
        }

        // No active quiz, return null (client can request new one)
        res.json({
            success: true,
            quiz: null,
            partner: {
                name: couple.partner1._id.toString() === userId ? couple.partner2.name : couple.partner1.name
            }
        });
    } catch (error) {
        console.error('Get active quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get quiz',
            error: error.message
        });
    }
};

// ===========================================
// Start New Quiz
// ===========================================
const startNewQuiz = async (req, res) => {
    try {
        const userId = req.user.id;
        const { category } = req.body; // Optional category filter

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

        // Check for existing active quiz
        const existingQuiz = await Quiz.findOne({
            coupleId: couple._id,
            status: { $in: ['pending', 'waiting'] }
        });

        if (existingQuiz) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active quiz. Complete it first!'
            });
        }

        // Get previously answered question IDs
        const answeredQuizzes = await Quiz.find({
            coupleId: couple._id,
            status: 'completed'
        }).select('questionId');

        const excludeIds = answeredQuizzes.map(q => q.questionId);

        // Get a random question
        let questions;
        if (category) {
            questions = Quiz.getQuestionsByCategory(category)
                .filter(q => !excludeIds.includes(q.id));
        } else {
            questions = Quiz.getRandomQuestions(1, excludeIds);
        }

        if (questions.length === 0) {
            // Reset - all questions answered, start over
            questions = Quiz.getRandomQuestions(1, []);
        }

        const selectedQuestion = questions[0];

        // Create new quiz
        const newQuiz = new Quiz({
            coupleId: couple._id,
            questionId: selectedQuestion.id,
            question: selectedQuestion.question,
            category: selectedQuestion.category,
            status: 'pending'
        });

        await newQuiz.save();

        res.status(201).json({
            success: true,
            message: 'New quiz started!',
            quiz: {
                id: newQuiz._id,
                questionId: newQuiz.questionId,
                question: newQuiz.question,
                category: newQuiz.category,
                status: newQuiz.status,
                hasUserAnswered: false,
                partnerHasAnswered: false,
                createdAt: newQuiz.createdAt
            }
        });
    } catch (error) {
        console.error('Start new quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start quiz',
            error: error.message
        });
    }
};

// ===========================================
// Submit Answer
// ===========================================
const submitAnswer = async (req, res) => {
    try {
        const userId = req.user.id;
        const { quizId } = req.params;
        const { answer } = req.body;

        if (!answer || !answer.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Answer is required'
            });
        }

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

        // Find the quiz
        const quiz = await Quiz.findOne({
            _id: quizId,
            coupleId: couple._id
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        if (quiz.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'This quiz is already completed'
            });
        }

        // Check if user already answered
        const hasUserAnswered = 
            (quiz.answer1.answeredBy?.toString() === userId) ||
            (quiz.answer2.answeredBy?.toString() === userId);

        if (hasUserAnswered) {
            return res.status(400).json({
                success: false,
                message: 'You already answered this question'
            });
        }

        // Submit answer
        if (!quiz.answer1.answeredBy) {
            quiz.answer1 = {
                text: answer.trim(),
                answeredBy: userId,
                answeredAt: new Date()
            };
            quiz.status = 'waiting';
        } else {
            quiz.answer2 = {
                text: answer.trim(),
                answeredBy: userId,
                answeredAt: new Date()
            };
            quiz.status = 'completed';
            quiz.completedAt = new Date();
            
            // Calculate match
            quiz.matchScore = quiz.calculateMatch();
            quiz.isMatched = quiz.matchScore >= 50;
        }

        await quiz.save();

        // Record activity interaction for streak tracking when quiz is completed
        if (quiz.status === 'completed') {
            recordInteraction(couple._id, 'activity');
        }

        // Prepare response
        const response = {
            success: true,
            message: quiz.status === 'completed' ? 'Both partners answered!' : 'Answer submitted! Waiting for partner...',
            quiz: {
                id: quiz._id,
                status: quiz.status,
                hasUserAnswered: true,
                partnerHasAnswered: quiz.status === 'completed'
            }
        };

        // If completed, include results
        if (quiz.status === 'completed') {
            response.quiz.results = {
                question: quiz.question,
                yourAnswer: quiz.answer1.answeredBy.toString() === userId ? quiz.answer1.text : quiz.answer2.text,
                partnerAnswer: quiz.answer1.answeredBy.toString() === userId ? quiz.answer2.text : quiz.answer1.text,
                matchScore: quiz.matchScore,
                isMatched: quiz.isMatched
            };
        }

        res.json(response);
    } catch (error) {
        console.error('Submit answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit answer',
            error: error.message
        });
    }
};

// ===========================================
// Get Quiz Results
// ===========================================
const getQuizResults = async (req, res) => {
    try {
        const userId = req.user.id;
        const { quizId } = req.params;

        // Find the user's couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Find the quiz
        const quiz = await Quiz.findOne({
            _id: quizId,
            coupleId: couple._id
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        if (quiz.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Quiz is not completed yet',
                status: quiz.status
            });
        }

        const isUser1 = quiz.answer1.answeredBy?.toString() === userId;

        res.json({
            success: true,
            results: {
                question: quiz.question,
                category: quiz.category,
                yourAnswer: isUser1 ? quiz.answer1.text : quiz.answer2.text,
                partnerAnswer: isUser1 ? quiz.answer2.text : quiz.answer1.text,
                partnerName: couple.partner1._id.toString() === userId ? couple.partner2.name : couple.partner1.name,
                matchScore: quiz.matchScore,
                isMatched: quiz.isMatched,
                completedAt: quiz.completedAt
            }
        });
    } catch (error) {
        console.error('Get quiz results error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get results',
            error: error.message
        });
    }
};

// ===========================================
// Get Quiz History
// ===========================================
const getQuizHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

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

        // Get completed quizzes
        const quizzes = await Quiz.find({
            coupleId: couple._id,
            status: 'completed'
        })
        .sort({ completedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

        const total = await Quiz.countDocuments({
            coupleId: couple._id,
            status: 'completed'
        });

        // Format results
        const history = quizzes.map(quiz => {
            const isUser1 = quiz.answer1.answeredBy?.toString() === userId;
            return {
                id: quiz._id,
                question: quiz.question,
                category: quiz.category,
                yourAnswer: isUser1 ? quiz.answer1.text : quiz.answer2.text,
                partnerAnswer: isUser1 ? quiz.answer2.text : quiz.answer1.text,
                matchScore: quiz.matchScore,
                isMatched: quiz.isMatched,
                completedAt: quiz.completedAt
            };
        });

        // Calculate overall stats
        const allCompleted = await Quiz.find({
            coupleId: couple._id,
            status: 'completed'
        }).select('matchScore isMatched');

        const totalCompleted = allCompleted.length;
        const totalMatched = allCompleted.filter(q => q.isMatched).length;
        const averageScore = totalCompleted > 0 
            ? Math.round(allCompleted.reduce((sum, q) => sum + (q.matchScore || 0), 0) / totalCompleted)
            : 0;

        res.json({
            success: true,
            history,
            stats: {
                totalQuizzes: totalCompleted,
                matchedQuizzes: totalMatched,
                matchRate: totalCompleted > 0 ? Math.round((totalMatched / totalCompleted) * 100) : 0,
                averageScore
            },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get quiz history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get history',
            error: error.message
        });
    }
};

// ===========================================
// Skip Current Quiz
// ===========================================
const skipQuiz = async (req, res) => {
    try {
        const userId = req.user.id;
        const { quizId } = req.params;

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

        // Delete the quiz
        await Quiz.findOneAndDelete({
            _id: quizId,
            coupleId: couple._id,
            status: { $in: ['pending', 'waiting'] }
        });

        res.json({
            success: true,
            message: 'Quiz skipped'
        });
    } catch (error) {
        console.error('Skip quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to skip quiz',
            error: error.message
        });
    }
};

// ===========================================
// Get Categories
// ===========================================
const getCategories = async (req, res) => {
    try {
        const categories = [
            { id: 'favorites', name: 'Favorites', emoji: '⭐', description: 'Learn about each other\'s favorites' },
            { id: 'memories', name: 'Memories', emoji: '💝', description: 'Remember your special moments' },
            { id: 'personality', name: 'Personality', emoji: '😊', description: 'Know each other\'s traits' },
            { id: 'future', name: 'Future', emoji: '🌟', description: 'Dreams and plans together' },
            { id: 'fun', name: 'Fun & Silly', emoji: '😄', description: 'Lighthearted questions' },
            { id: 'deep', name: 'Deep Connection', emoji: '💕', description: 'Meaningful conversations' }
        ];

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get categories',
            error: error.message
        });
    }
};

module.exports = {
    getActiveQuiz,
    startNewQuiz,
    submitAnswer,
    getQuizResults,
    getQuizHistory,
    skipQuiz,
    getCategories
};
