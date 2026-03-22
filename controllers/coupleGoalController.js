// ===========================================
// Couple Goal Controller
// Handles shared goal management for couples
// ===========================================

const CoupleGoal = require('../models/CoupleGoal');

const normalizeTitle = (value = '') => value.trim();
const normalizeProgress = (value = '') => value.trim();

// ===========================================
// Get all goals for current couple
// ===========================================
const getGoals = async (req, res) => {
    try {
        const userId = req.user.id;
        const coupleId = req.user.coupleId;

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You need to be in a couple to use shared goals'
            });
        }

        const goals = await CoupleGoal.find({ coupleId })
            .sort({ isCompleted: 1, updatedAt: -1 })
            .populate('createdBy', 'name avatar')
            .populate('updatedBy', 'name avatar');

        res.json({
            success: true,
            data: goals,
            meta: {
                total: goals.length,
                active: goals.filter((goal) => !goal.isCompleted).length,
                completed: goals.filter((goal) => goal.isCompleted).length,
                requestedBy: userId
            }
        });
    } catch (error) {
        console.error('Get couple goals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch couple goals',
            error: error.message
        });
    }
};

// ===========================================
// Create a new shared goal
// ===========================================
const createGoal = async (req, res) => {
    try {
        const userId = req.user.id;
        const coupleId = req.user.coupleId;
        const title = normalizeTitle(req.body.title || '');
        const progressStatus = normalizeProgress(req.body.progressStatus || 'Not started yet');
        const isCompleted = Boolean(req.body.isCompleted);

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You need to be in a couple to create shared goals'
            });
        }

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Goal title is required'
            });
        }

        const goal = await CoupleGoal.create({
            coupleId,
            createdBy: userId,
            updatedBy: userId,
            title,
            progressStatus,
            isCompleted,
            completedAt: isCompleted ? new Date() : null
        });

        const populatedGoal = await CoupleGoal.findById(goal._id)
            .populate('createdBy', 'name avatar')
            .populate('updatedBy', 'name avatar');

        res.status(201).json({
            success: true,
            message: 'Goal created successfully',
            data: populatedGoal
        });
    } catch (error) {
        console.error('Create couple goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create goal',
            error: error.message
        });
    }
};

// ===========================================
// Update a shared goal
// ===========================================
const updateGoal = async (req, res) => {
    try {
        const userId = req.user.id;
        const coupleId = req.user.coupleId;
        const { id } = req.params;

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You need to be in a couple to update shared goals'
            });
        }

        const goal = await CoupleGoal.findOne({ _id: id, coupleId });
        if (!goal) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        if (typeof req.body.title === 'string') {
            const nextTitle = normalizeTitle(req.body.title);
            if (!nextTitle) {
                return res.status(400).json({
                    success: false,
                    message: 'Goal title cannot be empty'
                });
            }
            goal.title = nextTitle;
        }

        if (typeof req.body.progressStatus === 'string') {
            goal.progressStatus = normalizeProgress(req.body.progressStatus);
        }

        if (typeof req.body.isCompleted === 'boolean') {
            goal.isCompleted = req.body.isCompleted;
            goal.completedAt = req.body.isCompleted ? new Date() : null;
        }

        goal.updatedBy = userId;

        await goal.save();

        const updatedGoal = await CoupleGoal.findById(goal._id)
            .populate('createdBy', 'name avatar')
            .populate('updatedBy', 'name avatar');

        res.json({
            success: true,
            message: 'Goal updated successfully',
            data: updatedGoal
        });
    } catch (error) {
        console.error('Update couple goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update goal',
            error: error.message
        });
    }
};

// ===========================================
// Delete a shared goal
// ===========================================
const deleteGoal = async (req, res) => {
    try {
        const coupleId = req.user.coupleId;
        const { id } = req.params;

        if (!coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You need to be in a couple to manage shared goals'
            });
        }

        const deleted = await CoupleGoal.findOneAndDelete({ _id: id, coupleId });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Goal not found'
            });
        }

        res.json({
            success: true,
            message: 'Goal deleted successfully'
        });
    } catch (error) {
        console.error('Delete couple goal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete goal',
            error: error.message
        });
    }
};

module.exports = {
    getGoals,
    createGoal,
    updateGoal,
    deleteGoal
};