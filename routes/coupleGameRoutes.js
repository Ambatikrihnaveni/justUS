// ===========================================
// Couple Games Routes
// Routes for couple games functionality
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getAvailableGames,
    startGame,
    getActiveGame,
    submitResponse,
    getHint,
    skipQuestion,
    endGame,
    getGameHistory,
    getGameStats,
    joinGame,
    makeMove
} = require('../controllers/coupleGameController');

// ===========================================
// Route Definitions
// ===========================================

// GET /api/games - Get available games list
router.get('/', protect, getAvailableGames);

// GET /api/games/active - Get current active game
router.get('/active', protect, getActiveGame);

// GET /api/games/history - Get game history
router.get('/history', protect, getGameHistory);

// GET /api/games/stats - Get game statistics
router.get('/stats', protect, getGameStats);

// POST /api/games/start - Start a new game
router.post('/start', protect, startGame);

// POST /api/games/:gameId/join - Join a game (for real-time multiplayer)
router.post('/:gameId/join', protect, joinGame);

// POST /api/games/:gameId/move - Make a move (for board games)
router.post('/:gameId/move', protect, makeMove);

// POST /api/games/:gameId/respond - Submit response
router.post('/:gameId/respond', protect, submitResponse);

// POST /api/games/:gameId/hint - Get hint (for riddles)
router.post('/:gameId/hint', protect, getHint);

// POST /api/games/:gameId/skip - Skip current question
router.post('/:gameId/skip', protect, skipQuestion);

// DELETE /api/games/:gameId - End game
router.delete('/:gameId', protect, endGame);

module.exports = router;
