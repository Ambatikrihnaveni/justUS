// ===========================================
// Message Scheduler Service
// Periodically checks and sends scheduled messages
// Also handles disappearing message expiry notifications
// And daily streak resets
// And reminder notifications
// ===========================================

const { processDueMessages } = require('../controllers/scheduledMessageController');
const Message = require('../models/Message');
const Couple = require('../models/Couple');
const { runAllReminderChecks, clearOldReminders } = require('./reminderService');

let schedulerInterval = null;
let expiryInterval = null;
let streakInterval = null;
let reminderInterval = null;
let io = null;

// ===========================================
// Start the scheduler
// ===========================================

const startScheduler = (socketIo) => {
    io = socketIo;
    
    // Check for due messages every 30 seconds
    const CHECK_INTERVAL = 30 * 1000; // 30 seconds
    // Check for expiring messages every 5 seconds (for accurate countdown)
    const EXPIRY_CHECK_INTERVAL = 5 * 1000; // 5 seconds
    // Check for streak resets every hour
    const STREAK_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
    // Check for reminders every 30 minutes
    const REMINDER_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
    
    console.log('📅 Message scheduler started (checking every 30 seconds)');
    console.log('⏱️ Disappearing message checker started (checking every 5 seconds)');
    console.log('🔥 Streak checker started (checking every hour)');
    console.log('🔔 Reminder checker started (checking every 30 minutes)');
    
    // Initial checks
    checkAndSendMessages();
    checkExpiringMessages();
    checkStreakResets();
    
    // Delay reminder check by 1 minute to let server fully start
    setTimeout(() => {
        runAllReminderChecks();
        clearOldReminders();
    }, 60 * 1000);
    
    // Set up intervals
    schedulerInterval = setInterval(checkAndSendMessages, CHECK_INTERVAL);
    expiryInterval = setInterval(checkExpiringMessages, EXPIRY_CHECK_INTERVAL);
    streakInterval = setInterval(checkStreakResets, STREAK_CHECK_INTERVAL);
    reminderInterval = setInterval(() => {
        runAllReminderChecks();
        clearOldReminders();
    }, REMINDER_CHECK_INTERVAL);
};

// ===========================================
// Stop the scheduler
// ===========================================

const stopScheduler = () => {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('📅 Message scheduler stopped');
    }
    if (expiryInterval) {
        clearInterval(expiryInterval);
        expiryInterval = null;
        console.log('⏱️ Disappearing message checker stopped');
    }
    if (streakInterval) {
        clearInterval(streakInterval);
        streakInterval = null;
        console.log('🔥 Streak checker stopped');
    }
    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
        console.log('🔔 Reminder checker stopped');
    }
};

// ===========================================
// Check and send due messages
// ===========================================

const checkAndSendMessages = async () => {
    try {
        const sentCount = await processDueMessages(io);
        if (sentCount > 0) {
            console.log(`📨 Sent ${sentCount} scheduled message(s)`);
        }
    } catch (error) {
        console.error('Scheduler error:', error.message);
    }
};

// ===========================================
// Check for expiring disappearing messages
// Notify both users before MongoDB TTL deletes them
// ===========================================

const checkExpiringMessages = async () => {
    try {
        const now = new Date();
        
        // Find messages that have expired
        const expiredMessages = await Message.find({
            isDisappearing: true,
            expiresAt: { $lte: now }
        }).select('_id senderId receiverId');

        if (expiredMessages.length > 0) {
            // Notify both sender and receiver about each expired message
            for (const msg of expiredMessages) {
                if (io) {
                    // Emit to both sender and receiver
                    io.to(msg.senderId.toString()).emit('messageExpired', {
                        messageId: msg._id
                    });
                    io.to(msg.receiverId.toString()).emit('messageExpired', {
                        messageId: msg._id
                    });
                }
            }

            // Delete expired messages immediately (don't wait for TTL)
            const ids = expiredMessages.map(m => m._id);
            await Message.deleteMany({ _id: { $in: ids } });
            
            console.log(`🔥 Deleted ${expiredMessages.length} expired disappearing message(s)`);
        }
    } catch (error) {
        console.error('Expiry check error:', error.message);
    }
};

// ===========================================
// Check for streak resets (couples who missed a day)
// ===========================================

const checkStreakResets = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Find couples who have a streak but didn't interact yesterday
        const couplesWithExpiredStreaks = await Couple.find({
            isComplete: true,
            currentStreak: { $gt: 0 },
            lastInteractionDate: { $lt: yesterday }
        });

        if (couplesWithExpiredStreaks.length > 0) {
            // Reset their streaks and notify
            for (const couple of couplesWithExpiredStreaks) {
                const previousStreak = couple.currentStreak;
                couple.currentStreak = 0;
                couple.todayInteractions = {
                    chat: false,
                    call: false,
                    activity: false
                };
                await couple.save();

                // Notify both partners via socket
                if (io) {
                    const partner1Id = couple.partner1?.toString();
                    const partner2Id = couple.partner2?.toString();
                    
                    const streakResetData = {
                        previousStreak,
                        currentStreak: 0,
                        message: `Your ${previousStreak} day streak has ended! Start a new one today! 💔`
                    };
                    
                    if (partner1Id) {
                        io.to(partner1Id).emit('streakReset', streakResetData);
                    }
                    if (partner2Id) {
                        io.to(partner2Id).emit('streakReset', streakResetData);
                    }
                }
            }
            
            console.log(`💔 Reset ${couplesWithExpiredStreaks.length} expired streak(s)`);
        }
    } catch (error) {
        console.error('Streak reset check error:', error.message);
    }
};

module.exports = {
    startScheduler,
    stopScheduler
};
