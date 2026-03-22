// ===========================================
// Silent Care Controller
// Handles status + optional auto-reply preferences
// ===========================================

const User = require('../models/User');
const Couple = require('../models/Couple');

const ALLOWED_STATUSES = ['available', 'busy', 'working', 'sleeping'];
const DEFAULT_AUTO_REPLY = "I'm busy right now, will talk later ❤️";

const sanitizeSilentCare = (silentCare = {}) => ({
    status: silentCare.status || 'available',
    autoReplyEnabled: !!silentCare.autoReplyEnabled,
    autoReplyMessage: silentCare.autoReplyMessage || DEFAULT_AUTO_REPLY,
    updatedAt: silentCare.updatedAt || null
});

const getPartnerIdFromCouple = (couple, currentUserId) => {
    const current = currentUserId.toString();
    if (couple.partner1?.toString() === current) return couple.partner2?.toString() || null;
    if (couple.partner2?.toString() === current) return couple.partner1?.toString() || null;
    return null;
};

// ===========================================
// GET /api/silent-care/me
// ===========================================
const getMySilentCare = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('silentCare');

        return res.status(200).json({
            success: true,
            silentCare: sanitizeSilentCare(user?.silentCare)
        });
    } catch (error) {
        console.error('Get silent care status error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching silent care status' });
    }
};

// ===========================================
// GET /api/silent-care/partner
// ===========================================
const getPartnerSilentCare = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id).select('coupleId');

        if (!currentUser?.coupleId) {
            return res.status(404).json({
                success: false,
                message: 'You are not part of a couple yet'
            });
        }

        const couple = await Couple.findById(currentUser.coupleId).select('partner1 partner2');
        if (!couple) {
            return res.status(404).json({ success: false, message: 'Couple not found' });
        }

        const partnerId = getPartnerIdFromCouple(couple, req.user._id);
        if (!partnerId) {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }

        const partner = await User.findById(partnerId).select('name avatar silentCare');
        if (!partner) {
            return res.status(404).json({ success: false, message: 'Partner not found' });
        }

        return res.status(200).json({
            success: true,
            partner: {
                _id: partner._id,
                name: partner.name,
                avatar: partner.avatar,
                silentCare: sanitizeSilentCare(partner.silentCare)
            }
        });
    } catch (error) {
        console.error('Get partner silent care status error:', error);
        return res.status(500).json({ success: false, message: 'Error fetching partner status' });
    }
};

// ===========================================
// PUT /api/silent-care/me
// ===========================================
const updateMySilentCare = async (req, res) => {
    try {
        const { status, autoReplyEnabled, autoReplyMessage } = req.body;

        if (!ALLOWED_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Use available, busy, working, or sleeping'
            });
        }

        const update = {
            status,
            autoReplyEnabled: typeof autoReplyEnabled === 'boolean' ? autoReplyEnabled : false,
            autoReplyMessage: (autoReplyMessage || DEFAULT_AUTO_REPLY).toString().trim().slice(0, 240),
            updatedAt: new Date()
        };

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { silentCare: update } },
            { new: true, runValidators: true }
        ).select('_id coupleId silentCare');

        // Notify partner in real-time when available.
        if (user?.coupleId) {
            const couple = await Couple.findById(user.coupleId).select('partner1 partner2');
            const partnerId = couple ? getPartnerIdFromCouple(couple, req.user._id) : null;

            if (partnerId) {
                const io = req.app.get('io');
                if (io) {
                    io.to(partnerId).emit('partnerSilentCareUpdated', {
                        userId: req.user._id.toString(),
                        silentCare: sanitizeSilentCare(user.silentCare)
                    });
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Silent Care Mode updated',
            silentCare: sanitizeSilentCare(user?.silentCare)
        });
    } catch (error) {
        console.error('Update silent care status error:', error);
        return res.status(500).json({ success: false, message: 'Error updating silent care status' });
    }
};

module.exports = {
    getMySilentCare,
    getPartnerSilentCare,
    updateMySilentCare
};
