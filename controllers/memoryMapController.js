// ===========================================
// Memory Map Controller
// Handles map-related memory operations
// ===========================================

const Memory = require('../models/Memory');
const Couple = require('../models/Couple');

// ===========================================
// Get Memories With Locations
// ===========================================
const getMemoriesWithLocations = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user's couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Find all memories that have coordinates
        const memories = await Memory.find({
            coupleId: couple._id,
            'coordinates.latitude': { $ne: null },
            'coordinates.longitude': { $ne: null }
        })
        .select('title description image memoryDate location coordinates category uploadedBy')
        .populate('uploadedBy', 'name avatar')
        .sort({ memoryDate: -1 });

        // Format memories for map display
        const mapMemories = memories.map(memory => ({
            id: memory._id,
            title: memory.title || 'Untitled Memory',
            description: memory.description || '',
            image: memory.image,
            date: memory.memoryDate,
            location: memory.location,
            coordinates: {
                lat: memory.coordinates.latitude,
                lng: memory.coordinates.longitude
            },
            category: memory.category,
            uploadedBy: {
                name: memory.uploadedBy?.name || 'Unknown',
                avatar: memory.uploadedBy?.avatar
            }
        }));

        // Calculate map center (average of all coordinates or default)
        let center = { lat: 40.7128, lng: -74.0060 }; // Default to NYC
        if (mapMemories.length > 0) {
            const avgLat = mapMemories.reduce((sum, m) => sum + m.coordinates.lat, 0) / mapMemories.length;
            const avgLng = mapMemories.reduce((sum, m) => sum + m.coordinates.lng, 0) / mapMemories.length;
            center = { lat: avgLat, lng: avgLng };
        }

        res.json({
            success: true,
            memoryMap: {
                memories: mapMemories,
                center,
                totalCount: mapMemories.length
            }
        });
    } catch (error) {
        console.error('Get memories with locations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load memory map',
            error: error.message
        });
    }
};

// ===========================================
// Add Location to Existing Memory
// ===========================================
const addLocationToMemory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { memoryId } = req.params;
        const { latitude, longitude, location } = req.body;

        // Find the user's couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Find and update the memory
        const memory = await Memory.findOneAndUpdate(
            { _id: memoryId, coupleId: couple._id },
            {
                coordinates: { latitude, longitude },
                location: location || '',
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!memory) {
            return res.status(404).json({
                success: false,
                message: 'Memory not found'
            });
        }

        res.json({
            success: true,
            message: 'Location added to memory',
            memory: {
                id: memory._id,
                title: memory.title,
                coordinates: memory.coordinates,
                location: memory.location
            }
        });
    } catch (error) {
        console.error('Add location to memory error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add location',
            error: error.message
        });
    }
};

// ===========================================
// Get Memory Map Stats
// ===========================================
const getMapStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user's couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Get stats
        const totalMemories = await Memory.countDocuments({ coupleId: couple._id });
        const memoriesWithLocation = await Memory.countDocuments({
            coupleId: couple._id,
            'coordinates.latitude': { $ne: null },
            'coordinates.longitude': { $ne: null }
        });

        // Get category breakdown
        const categoryBreakdown = await Memory.aggregate([
            {
                $match: {
                    coupleId: couple._id,
                    'coordinates.latitude': { $ne: null },
                    'coordinates.longitude': { $ne: null }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            }
        ]);

        const categories = {};
        categoryBreakdown.forEach(cat => {
            categories[cat._id] = cat.count;
        });

        res.json({
            success: true,
            stats: {
                totalMemories,
                memoriesWithLocation,
                memoriesWithoutLocation: totalMemories - memoriesWithLocation,
                categories
            }
        });
    } catch (error) {
        console.error('Get map stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load map stats',
            error: error.message
        });
    }
};

module.exports = {
    getMemoriesWithLocations,
    addLocationToMemory,
    getMapStats
};
