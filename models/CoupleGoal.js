// ===========================================
// CoupleGoal Model
// Stores shared goals for a couple
// ===========================================

const mongoose = require('mongoose');

const coupleGoalSchema = new mongoose.Schema(
    {
        // Couple that owns this goal
        coupleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Couple',
            required: true,
            index: true
        },

        // User who created the goal
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // Last user who updated the goal
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        // Goal title (e.g., "Save for our trip")
        title: {
            type: String,
            required: [true, 'Goal title is required'],
            trim: true,
            maxlength: [120, 'Goal title cannot exceed 120 characters']
        },

        // Human-friendly progress text (e.g., "Booked flights")
        progressStatus: {
            type: String,
            trim: true,
            maxlength: [180, 'Progress status cannot exceed 180 characters'],
            default: 'Not started yet'
        },

        // Completion state shared by both partners
        isCompleted: {
            type: Boolean,
            default: false
        },

        completedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

coupleGoalSchema.index({ coupleId: 1, isCompleted: 1, updatedAt: -1 });

const CoupleGoal = mongoose.model('CoupleGoal', coupleGoalSchema);

module.exports = CoupleGoal;