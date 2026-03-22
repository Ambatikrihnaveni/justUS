// ===========================================
// Activity Heatmap Controller
// Aggregates partner activity by weekday and hour
// ===========================================

const User = require('../models/User');
const Message = require('../models/Message');
const Call = require('../models/Call');

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);

const initGrid = () => Array.from({ length: 7 }, () => Array(24).fill(0));

const localBucket = (dateValue, timezoneOffsetMinutes) => {
    const date = new Date(dateValue);
    const shifted = new Date(date.getTime() - timezoneOffsetMinutes * 60 * 1000);
    return {
        day: shifted.getUTCDay(),
        hour: shifted.getUTCHours()
    };
};

const getActivityHeatmap = async (req, res) => {
    try {
        const userId = req.user._id;
        const periodDays = Math.max(7, Math.min(parseInt(req.query.days, 10) || 30, 90));
        const timezoneOffsetMinutes = Number.isFinite(Number(req.query.timezoneOffsetMinutes))
            ? parseInt(req.query.timezoneOffsetMinutes, 10)
            : 0;

        const user = await User.findById(userId).select('coupleId');
        if (!user || !user.coupleId) {
            return res.status(400).json({
                success: false,
                message: 'You must be in a couple to view activity heatmap'
            });
        }

        const [partnerA, partnerB] = await User.find({ coupleId: user.coupleId })
            .select('_id name avatar')
            .limit(2);

        if (!partnerA || !partnerB) {
            return res.status(404).json({
                success: false,
                message: 'Both partners are required to generate activity heatmap'
            });
        }

        const partnerIds = [partnerA._id, partnerB._id];
        const since = new Date();
        since.setDate(since.getDate() - periodDays);

        const [messages, calls] = await Promise.all([
            Message.find({
                senderId: { $in: partnerIds },
                createdAt: { $gte: since },
                isDeleted: { $ne: true },
                isUnsent: { $ne: true }
            })
                .select('senderId createdAt')
                .lean(),
            Call.find({
                callerId: { $in: partnerIds },
                startedAt: { $gte: since }
            })
                .select('callerId receiverId status startedAt')
                .lean()
        ]);

        const combinedGrid = initGrid();
        const partnerGridMap = {
            [partnerA._id.toString()]: initGrid(),
            [partnerB._id.toString()]: initGrid()
        };
        const totalByPartner = {
            [partnerA._id.toString()]: 0,
            [partnerB._id.toString()]: 0
        };

        const applyActivity = (actorId, dateValue) => {
            const actorKey = actorId.toString();
            if (!partnerGridMap[actorKey]) return;

            const { day, hour } = localBucket(dateValue, timezoneOffsetMinutes);
            partnerGridMap[actorKey][day][hour] += 1;
            combinedGrid[day][hour] += 1;
            totalByPartner[actorKey] += 1;
        };

        messages.forEach((message) => {
            applyActivity(message.senderId, message.createdAt);
        });

        calls.forEach((call) => {
            applyActivity(call.callerId, call.startedAt);

            // Count answered call activity for receiver as well.
            if (call.status === 'answered' && call.receiverId) {
                applyActivity(call.receiverId, call.startedAt);
            }
        });

        const enrichPartner = (partner) => {
            const key = partner._id.toString();
            const grid = partnerGridMap[key];

            let peak = { count: 0, day: 0, hour: 0 };
            for (let day = 0; day < 7; day += 1) {
                for (let hour = 0; hour < 24; hour += 1) {
                    if (grid[day][hour] > peak.count) {
                        peak = { count: grid[day][hour], day, hour };
                    }
                }
            }

            return {
                userId: key,
                name: partner.name,
                avatar: partner.avatar || '',
                totalActivity: totalByPartner[key],
                peakActivity: {
                    count: peak.count,
                    dayLabel: DAY_LABELS[peak.day],
                    hourLabel: HOUR_LABELS[peak.hour]
                },
                grid
            };
        };

        res.json({
            success: true,
            data: {
                periodDays,
                timezoneOffsetMinutes,
                dayLabels: DAY_LABELS,
                hourLabels: HOUR_LABELS,
                combinedGrid,
                partners: [enrichPartner(partnerA), enrichPartner(partnerB)]
            }
        });
    } catch (error) {
        console.error('Get activity heatmap error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity heatmap',
            error: error.message
        });
    }
};

module.exports = {
    getActivityHeatmap
};
