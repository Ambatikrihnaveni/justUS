// ===========================================
// Daily Question Routes
// Routes for daily couple questions feature
// ===========================================

const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middleware/authMiddleware');

// Import controller
const {
    getTodaysQuestion,
    submitAnswer,
    getAnswerHistory,
    seedQuestions
} = require('../controllers/dailyQuestionController');

// All routes require authentication
router.use(protect);

// ===========================================
// Routes
// ===========================================

// Get today's question with answer status
router.get('/', getTodaysQuestion);

// Submit an answer
router.post('/answer', submitAnswer);

// Get history of answered questions
router.get('/history', getAnswerHistory);

// Seed questions (can be called once to populate questions)
router.post('/seed', seedQuestions);

module.exports = router;
