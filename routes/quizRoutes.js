// ===========================================
// Quiz Routes
// Routes for couple love quiz
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getActiveQuiz,
    startNewQuiz,
    submitAnswer,
    getQuizResults,
    getQuizHistory,
    skipQuiz,
    getCategories
} = require('../controllers/quizController');

// ===========================================
// Route Definitions
// ===========================================

// GET /api/quiz - Get active quiz
router.get('/', protect, getActiveQuiz);

// GET /api/quiz/categories - Get quiz categories
router.get('/categories', protect, getCategories);

// GET /api/quiz/history - Get quiz history
router.get('/history', protect, getQuizHistory);

// POST /api/quiz/start - Start a new quiz
router.post('/start', protect, startNewQuiz);

// POST /api/quiz/:quizId/answer - Submit answer
router.post('/:quizId/answer', protect, submitAnswer);

// GET /api/quiz/:quizId/results - Get quiz results
router.get('/:quizId/results', protect, getQuizResults);

// DELETE /api/quiz/:quizId - Skip/delete quiz
router.delete('/:quizId', protect, skipQuiz);

module.exports = router;
