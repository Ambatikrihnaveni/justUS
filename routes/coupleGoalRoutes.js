// ===========================================
// Couple Goal Routes
// Routes for shared couple goals
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getGoals,
    createGoal,
    updateGoal,
    deleteGoal
} = require('../controllers/coupleGoalController');

// All routes require authentication
router.use(protect);

router.get('/', getGoals);
router.post('/', createGoal);
router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);

module.exports = router;