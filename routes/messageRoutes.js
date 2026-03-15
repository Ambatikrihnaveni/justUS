// ===========================================
// Message Routes
// Handles chat message endpoints
// ===========================================

const express = require('express');
const router = express.Router();

// Import controller functions
const {
    getChatHistory,
    sendMessage,
    markAsSeen,
    getUnreadCount,
    editMessage,
    unsendMessage,
    deleteForBoth,
    deleteMessage
} = require('../controllers/messageController');

// Import auth middleware
const { protect } = require('../middleware/authMiddleware');

// All message routes require authentication
router.use(protect);

// ===========================================
// Message Routes
// ===========================================

// GET /api/messages/unread - Get unread message count
router.get('/unread', getUnreadCount);

// GET /api/messages/:userId - Get chat history with user
router.get('/:userId', getChatHistory);

// POST /api/messages - Send a new message
router.post('/', sendMessage);

// PUT /api/messages/seen/:senderId - Mark messages as seen
router.put('/seen/:senderId', markAsSeen);

// PUT /api/messages/:messageId - Edit a message
router.put('/:messageId', editMessage);

// DELETE /api/messages/:messageId/unsend - Unsend message (completely remove)
router.delete('/:messageId/unsend', unsendMessage);

// DELETE /api/messages/:messageId/both - Delete for both (shows "message deleted")
router.delete('/:messageId/both', deleteForBoth);

// DELETE /api/messages/:messageId - Delete message (delete for me only)
router.delete('/:messageId', deleteMessage);

module.exports = router;
