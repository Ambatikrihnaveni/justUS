// ===========================================
// Silent Care Routes
// Status sharing + optional auto-reply settings
// ===========================================

const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const {
    getMySilentCare,
    getPartnerSilentCare,
    updateMySilentCare
} = require('../controllers/silentCareController');

router.use(protect);

router.get('/me', getMySilentCare);
router.get('/partner', getPartnerSilentCare);
router.put('/me', updateMySilentCare);

module.exports = router;
