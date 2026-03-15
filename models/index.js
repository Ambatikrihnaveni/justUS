// ===========================================
// Models Index
// Central export for all models
// ===========================================

const User = require('./User');
const Message = require('./Message');
const Call = require('./Call');
const Couple = require('./Couple');
const Memory = require('./Memory');
const SavedMessage = require('./SavedMessage');

module.exports = {
    User,
    Message,
    Call,
    Couple,
    Memory,
    SavedMessage
};
