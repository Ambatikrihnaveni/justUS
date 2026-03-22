// ===========================================
// Reminder Service
// Sends daily reminders and activity notifications
// ===========================================

const User = require('../models/User');
const Couple = require('../models/Couple');
const Message = require('../models/Message');
const DailyQuestion = require('../models/DailyQuestion');
const CoupleAnswer = require('../models/CoupleAnswer');
const Quiz = require('../models/Quiz');
const CoupleGoal = require('../models/CoupleGoal');
const LoveLetter = require('../models/LoveLetter');
const CalendarEvent = require('../models/CalendarEvent');
const { sendPushNotification } = require('./pushNotificationService');

// Track sent reminders to avoid spam (in-memory, resets on server restart)
const sentReminders = new Map();

// Reminder types with their cool-down periods (in hours)
const REMINDER_COOLDOWNS = {
    no_chat: 8,           // 8 hours between "haven't talked" reminders
    daily_question: 12,   // 12 hours between question reminders
    quiz_available: 24,   // Once per day for quiz reminders
    streak_risk: 6,       // 6 hours for streak at risk
    love_letter: 24,      // Once per day for unread love letters
    calendar_event: 2,    // 2 hours before event reminder
    mood_update: 12,      // 12 hours between mood reminders
    goal_reminder: 24,    // Once per day for goal progress
    partner_missing: 8,   // 8 hours for "partner misses you"
};

// ===========================================
// Helper: Check if reminder was recently sent
// ===========================================

const canSendReminder = (coupleId, reminderType) => {
    const key = `${coupleId}-${reminderType}`;
    const lastSent = sentReminders.get(key);
    
    if (!lastSent) return true;
    
    const cooldownHours = REMINDER_COOLDOWNS[reminderType] || 12;
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    
    return (Date.now() - lastSent) >= cooldownMs;
};

const markReminderSent = (coupleId, reminderType) => {
    const key = `${coupleId}-${reminderType}`;
    sentReminders.set(key, Date.now());
};

// ===========================================
// Send Reminder Notification
// ===========================================

const sendReminderNotification = async (user, title, body, data = {}) => {
    if (!user?.fcmToken) {
        console.log(`⚠️ No FCM token for user ${user?.name || 'unknown'}`);
        return false;
    }

    try {
        const result = await sendPushNotification(
            user.fcmToken,
            title,
            body,
            {
                type: 'reminder',
                ...data
            },
            {
                channelId: 'justus_reminders',
                priority: 'default'
            }
        );
        
        if (result) {
            console.log(`📬 Reminder sent to ${user.name}: ${title}`);
        }
        return result;
    } catch (error) {
        console.error('Failed to send reminder:', error);
        return false;
    }
};

// ===========================================
// Check: Haven't Talked Today
// ===========================================

const checkNoChatReminder = async () => {
    console.log('🔔 Checking for "no chat" reminders...');
    
    try {
        // Get all complete couples
        const couples = await Couple.find({ isComplete: true })
            .populate('partner1', 'name fcmToken')
            .populate('partner2', 'name fcmToken');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const couple of couples) {
            if (!canSendReminder(couple._id, 'no_chat')) continue;

            // Check if there are any messages today
            const todaysMessages = await Message.countDocuments({
                $or: [
                    { senderId: couple.partner1._id, receiverId: couple.partner2._id },
                    { senderId: couple.partner2._id, receiverId: couple.partner1._id }
                ],
                createdAt: { $gte: today }
            });

            if (todaysMessages === 0) {
                // Send reminder to both partners
                const partner1Name = couple.partner1.name?.split(' ')[0] || 'Your love';
                const partner2Name = couple.partner2.name?.split(' ')[0] || 'Your love';

                await Promise.all([
                    sendReminderNotification(
                        couple.partner1,
                        '💭 Missing You',
                        `Haven't heard from ${partner2Name} today. Send them a sweet message! 💕`,
                        { reminderType: 'no_chat' }
                    ),
                    sendReminderNotification(
                        couple.partner2,
                        '💭 Missing You',
                        `Haven't heard from ${partner1Name} today. Send them a sweet message! 💕`,
                        { reminderType: 'no_chat' }
                    )
                ]);

                markReminderSent(couple._id, 'no_chat');
            }
        }
    } catch (error) {
        console.error('Error checking no chat reminders:', error);
    }
};

// ===========================================
// Check: Daily Question Not Answered
// ===========================================

const checkDailyQuestionReminder = async () => {
    console.log('🔔 Checking for daily question reminders...');
    
    try {
        // Get today's question
        const todaysQuestion = await DailyQuestion.getTodaysQuestion();
        if (!todaysQuestion) return;

        // Get all complete couples
        const couples = await Couple.find({ isComplete: true })
            .populate('partner1', 'name fcmToken')
            .populate('partner2', 'name fcmToken');

        for (const couple of couples) {
            if (!canSendReminder(couple._id, 'daily_question')) continue;

            // Check if couple has answered today's question
            const answer = await CoupleAnswer.findOne({
                coupleId: couple._id,
                questionId: todaysQuestion._id
            });

            // If no answer record or not both answered
            if (!answer || !answer.partner1Answer?.text || !answer.partner2Answer?.text) {
                const usersToNotify = [];

                if (!answer?.partner1Answer?.text) {
                    usersToNotify.push(couple.partner1);
                }
                if (!answer?.partner2Answer?.text) {
                    usersToNotify.push(couple.partner2);
                }

                for (const user of usersToNotify) {
                    await sendReminderNotification(
                        user,
                        '✨ Daily Question Waiting',
                        `"${todaysQuestion.question.substring(0, 50)}..." - Answer together! 💕`,
                        { reminderType: 'daily_question' }
                    );
                }

                if (usersToNotify.length > 0) {
                    markReminderSent(couple._id, 'daily_question');
                }
            }
        }
    } catch (error) {
        console.error('Error checking daily question reminders:', error);
    }
};

// ===========================================
// Check: Streak At Risk
// ===========================================

const checkStreakRiskReminder = async () => {
    console.log('🔔 Checking for streak risk reminders...');
    
    try {
        const couples = await Couple.find({ 
            isComplete: true,
            'streak.currentStreak': { $gt: 0 }
        })
            .populate('partner1', 'name fcmToken')
            .populate('partner2', 'name fcmToken');

        const now = new Date();

        for (const couple of couples) {
            if (!canSendReminder(couple._id, 'streak_risk')) continue;

            const lastInteraction = couple.streak?.lastInteractionDate;
            if (!lastInteraction) continue;

            // Check if it's been more than 20 hours since last interaction
            const hoursSinceInteraction = (now - new Date(lastInteraction)) / (1000 * 60 * 60);
            
            if (hoursSinceInteraction >= 20 && hoursSinceInteraction < 24) {
                const streakDays = couple.streak.currentStreak;
                
                await Promise.all([
                    sendReminderNotification(
                        couple.partner1,
                        '🔥 Streak At Risk!',
                        `Your ${streakDays}-day streak ends in ${Math.floor(24 - hoursSinceInteraction)} hours! Send a quick message 💕`,
                        { reminderType: 'streak_risk', streakDays }
                    ),
                    sendReminderNotification(
                        couple.partner2,
                        '🔥 Streak At Risk!',
                        `Your ${streakDays}-day streak ends in ${Math.floor(24 - hoursSinceInteraction)} hours! Send a quick message 💕`,
                        { reminderType: 'streak_risk', streakDays }
                    )
                ]);

                markReminderSent(couple._id, 'streak_risk');
            }
        }
    } catch (error) {
        console.error('Error checking streak risk reminders:', error);
    }
};

// ===========================================
// Check: Unread Love Letters
// ===========================================

const checkLoveLetterReminder = async () => {
    console.log('🔔 Checking for love letter reminders...');
    
    try {
        // Find unread love letters that are unlocked
        const unreadLetters = await LoveLetter.find({
            isOpened: false,
            unlockDate: { $lte: new Date() }
        }).populate('senderId receiverId', 'name fcmToken');

        for (const letter of unreadLetters) {
            const couple = await Couple.findOne({
                $or: [
                    { partner1: letter.senderId._id, partner2: letter.receiverId._id },
                    { partner1: letter.receiverId._id, partner2: letter.senderId._id }
                ],
                isComplete: true
            });

            if (!couple || !canSendReminder(couple._id, 'love_letter')) continue;

            await sendReminderNotification(
                letter.receiverId,
                '💌 Love Letter Waiting',
                `${letter.senderId.name} wrote you a secret letter! Open it now 💕`,
                { reminderType: 'love_letter', letterId: letter._id.toString() }
            );

            markReminderSent(couple._id, 'love_letter');
        }
    } catch (error) {
        console.error('Error checking love letter reminders:', error);
    }
};

// ===========================================
// Check: Quiz Available
// ===========================================

const checkQuizReminder = async () => {
    console.log('🔔 Checking for quiz reminders...');
    
    try {
        const couples = await Couple.find({ isComplete: true })
            .populate('partner1', 'name fcmToken')
            .populate('partner2', 'name fcmToken');

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        for (const couple of couples) {
            if (!canSendReminder(couple._id, 'quiz_available')) continue;

            // Check when they last took a quiz
            const lastQuiz = await Quiz.findOne({
                coupleId: couple._id
            }).sort({ createdAt: -1 });

            // If no quiz or last quiz was more than a week ago
            if (!lastQuiz || lastQuiz.createdAt < oneWeekAgo) {
                await Promise.all([
                    sendReminderNotification(
                        couple.partner1,
                        '🎯 Quiz Time!',
                        'Test how well you know each other! Take a fun quiz together 💕',
                        { reminderType: 'quiz_available' }
                    ),
                    sendReminderNotification(
                        couple.partner2,
                        '🎯 Quiz Time!',
                        'Test how well you know each other! Take a fun quiz together 💕',
                        { reminderType: 'quiz_available' }
                    )
                ]);

                markReminderSent(couple._id, 'quiz_available');
            }
        }
    } catch (error) {
        console.error('Error checking quiz reminders:', error);
    }
};

// ===========================================
// Check: Couple Goals
// ===========================================

const checkGoalReminder = async () => {
    console.log('🔔 Checking for goal reminders...');
    
    try {
        // Find incomplete goals
        const incompleteGoals = await CoupleGoal.find({
            completed: false,
            deadline: { $gte: new Date() }
        });

        for (const goal of incompleteGoals) {
            const couple = await Couple.findById(goal.coupleId)
                .populate('partner1', 'name fcmToken')
                .populate('partner2', 'name fcmToken');

            if (!couple || !canSendReminder(couple._id, 'goal_reminder')) continue;

            // Calculate days until deadline
            const daysUntil = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
            
            // Only remind if deadline is within 3 days
            if (daysUntil <= 3) {
                const progress = Math.round((goal.progress / goal.target) * 100);

                await Promise.all([
                    sendReminderNotification(
                        couple.partner1,
                        '🎯 Goal Deadline Coming!',
                        `"${goal.title}" is ${progress}% complete. ${daysUntil} day(s) left! 💪`,
                        { reminderType: 'goal_reminder', goalId: goal._id.toString() }
                    ),
                    sendReminderNotification(
                        couple.partner2,
                        '🎯 Goal Deadline Coming!',
                        `"${goal.title}" is ${progress}% complete. ${daysUntil} day(s) left! 💪`,
                        { reminderType: 'goal_reminder', goalId: goal._id.toString() }
                    )
                ]);

                markReminderSent(couple._id, 'goal_reminder');
            }
        }
    } catch (error) {
        console.error('Error checking goal reminders:', error);
    }
};

// ===========================================
// Check: Calendar Events Today
// ===========================================

const checkCalendarReminder = async () => {
    console.log('🔔 Checking for calendar event reminders...');
    
    try {
        const now = new Date();
        const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        // Find events starting in the next 2 hours
        const upcomingEvents = await CalendarEvent.find({
            date: {
                $gte: now,
                $lte: twoHoursLater
            }
        });

        for (const event of upcomingEvents) {
            const couple = await Couple.findById(event.coupleId)
                .populate('partner1', 'name fcmToken')
                .populate('partner2', 'name fcmToken');

            if (!couple || !canSendReminder(couple._id, 'calendar_event')) continue;

            const eventTime = new Date(event.date);
            const minutesUntil = Math.round((eventTime - now) / (1000 * 60));

            await Promise.all([
                sendReminderNotification(
                    couple.partner1,
                    `📅 ${event.title}`,
                    `Coming up in ${minutesUntil} minutes! ${event.isSpecial ? '🌟' : ''}`,
                    { reminderType: 'calendar_event', eventId: event._id.toString() }
                ),
                sendReminderNotification(
                    couple.partner2,
                    `📅 ${event.title}`,
                    `Coming up in ${minutesUntil} minutes! ${event.isSpecial ? '🌟' : ''}`,
                    { reminderType: 'calendar_event', eventId: event._id.toString() }
                )
            ]);

            markReminderSent(couple._id, 'calendar_event');
        }
    } catch (error) {
        console.error('Error checking calendar reminders:', error);
    }
};

// ===========================================
// Check: Mood Not Updated
// ===========================================

const checkMoodReminder = async () => {
    console.log('🔔 Checking for mood update reminders...');
    
    try {
        const couples = await Couple.find({ isComplete: true })
            .populate('partner1', 'name fcmToken mood')
            .populate('partner2', 'name fcmToken mood');

        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

        for (const couple of couples) {
            if (!canSendReminder(couple._id, 'mood_update')) continue;

            const usersToRemind = [];

            // Check partner1's mood
            if (!couple.partner1.mood?.updatedAt || new Date(couple.partner1.mood.updatedAt) < twelveHoursAgo) {
                usersToRemind.push({
                    user: couple.partner1,
                    partnerName: couple.partner2.name?.split(' ')[0] || 'Your love'
                });
            }

            // Check partner2's mood
            if (!couple.partner2.mood?.updatedAt || new Date(couple.partner2.mood.updatedAt) < twelveHoursAgo) {
                usersToRemind.push({
                    user: couple.partner2,
                    partnerName: couple.partner1.name?.split(' ')[0] || 'Your love'
                });
            }

            for (const { user, partnerName } of usersToRemind) {
                await sendReminderNotification(
                    user,
                    '😊 How are you feeling?',
                    `Share your mood with ${partnerName}! Stay connected 💕`,
                    { reminderType: 'mood_update' }
                );
            }

            if (usersToRemind.length > 0) {
                markReminderSent(couple._id, 'mood_update');
            }
        }
    } catch (error) {
        console.error('Error checking mood reminders:', error);
    }
};

// ===========================================
// Check: Partner Set "Missing You" Mood
// ===========================================

const checkPartnerMissingReminder = async () => {
    console.log('🔔 Checking for partner missing reminders...');
    
    try {
        const couples = await Couple.find({ isComplete: true })
            .populate('partner1', 'name fcmToken mood')
            .populate('partner2', 'name fcmToken mood');

        for (const couple of couples) {
            if (!canSendReminder(couple._id, 'partner_missing')) continue;

            // Check if partner1 has "missing_you" mood
            if (couple.partner1.mood?.current === 'missing_you') {
                await sendReminderNotification(
                    couple.partner2,
                    '🥺 Someone Misses You',
                    `${couple.partner1.name?.split(' ')[0]} is missing you right now! 💕`,
                    { reminderType: 'partner_missing' }
                );
                markReminderSent(couple._id, 'partner_missing');
            }
            // Check if partner2 has "missing_you" mood
            else if (couple.partner2.mood?.current === 'missing_you') {
                await sendReminderNotification(
                    couple.partner1,
                    '🥺 Someone Misses You',
                    `${couple.partner2.name?.split(' ')[0]} is missing you right now! 💕`,
                    { reminderType: 'partner_missing' }
                );
                markReminderSent(couple._id, 'partner_missing');
            }
        }
    } catch (error) {
        console.error('Error checking partner missing reminders:', error);
    }
};

// ===========================================
// Run All Reminder Checks
// ===========================================

const runAllReminderChecks = async () => {
    console.log('🔔 Running all reminder checks...');
    
    await Promise.all([
        checkNoChatReminder(),
        checkDailyQuestionReminder(),
        checkStreakRiskReminder(),
        checkLoveLetterReminder(),
        checkQuizReminder(),
        checkGoalReminder(),
        checkCalendarReminder(),
        checkMoodReminder(),
        checkPartnerMissingReminder()
    ]);
    
    console.log('✅ Reminder checks completed');
};

// ===========================================
// Clear old reminder tracking (cleanup)
// ===========================================

const clearOldReminders = () => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [key, timestamp] of sentReminders.entries()) {
        if (timestamp < oneDayAgo) {
            sentReminders.delete(key);
        }
    }
};

module.exports = {
    runAllReminderChecks,
    checkNoChatReminder,
    checkDailyQuestionReminder,
    checkStreakRiskReminder,
    checkLoveLetterReminder,
    checkQuizReminder,
    checkGoalReminder,
    checkCalendarReminder,
    checkMoodReminder,
    checkPartnerMissingReminder,
    clearOldReminders
};
