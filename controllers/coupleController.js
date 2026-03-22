// ===========================================
// Couple Controller
// Handles couple profile and relationship logic
// ===========================================

const Couple = require('../models/Couple');
const Memory = require('../models/Memory');
const User = require('../models/User');

// ===========================================
// Create Couple Space
// POST /api/couple/create
// ===========================================

const createCouple = async (req, res) => {
    try {
        const userId = req.user._id;

        // Check if user already has a couple
        const existingCouple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (existingCouple) {
            return res.status(400).json({
                success: false,
                message: 'You are already part of a couple'
            });
        }

        // Generate unique invite code
        let inviteCode;
        let isUnique = false;
        while (!isUnique) {
            inviteCode = Couple.generateInviteCode();
            const existing = await Couple.findOne({ inviteCode });
            if (!existing) isUnique = true;
        }

        // Create the couple
        const couple = await Couple.create({
            partner1: userId,
            inviteCode,
            coupleName: req.body.coupleName || '',
            relationshipStatus: req.body.relationshipStatus || 'dating'
        });

        // Update user with couple reference
        await User.findByIdAndUpdate(userId, { coupleId: couple._id });

        // Populate partner info
        await couple.populate('partner1', 'name email avatar');

        res.status(201).json({
            success: true,
            message: 'Couple space created successfully',
            data: {
                couple,
                inviteCode
            }
        });

    } catch (error) {
        console.error('Create couple error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating couple space'
        });
    }
};

// ===========================================
// Join Couple via Invite Code
// POST /api/couple/join
// ===========================================

const joinCouple = async (req, res) => {
    try {
        const userId = req.user._id;
        const { inviteCode } = req.body;

        if (!inviteCode) {
            return res.status(400).json({
                success: false,
                message: 'Invite code is required'
            });
        }

        // Check if user already has a couple
        const existingCouple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (existingCouple) {
            return res.status(400).json({
                success: false,
                message: 'You are already part of a couple'
            });
        }

        // Find couple by invite code
        const couple = await Couple.findByInviteCode(inviteCode);

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Invalid invite code'
            });
        }

        // Check if couple already has two partners
        if (couple.partner2) {
            return res.status(400).json({
                success: false,
                message: 'This couple space is already full'
            });
        }

        // Check if user is trying to join their own couple
        if (couple.partner1._id.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot join your own couple space'
            });
        }

        // Add user as partner2
        couple.partner2 = userId;
        couple.isComplete = true;
        await couple.save();

        // Update user with couple reference
        await User.findByIdAndUpdate(userId, { coupleId: couple._id });

        // Populate both partners
        await couple.populate('partner1', 'name email avatar');
        await couple.populate('partner2', 'name email avatar');

        res.status(200).json({
            success: true,
            message: 'Successfully joined couple space',
            data: couple
        });

    } catch (error) {
        console.error('Join couple error:', error);
        res.status(500).json({
            success: false,
            message: 'Error joining couple space'
        });
    }
};

// ===========================================
// Get Couple Profile
// GET /api/couple/profile
// ===========================================

const getCoupleProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find couple where user is a partner
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        })
        .populate('partner1', 'name nickname email avatar dateOfBirth gender phoneNumber city country bio preferences mood lastSeen')
        .populate('partner2', 'name nickname email avatar dateOfBirth gender phoneNumber city country bio preferences mood lastSeen');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'No couple profile found',
                hasCouple: false
            });
        }

        // Calculate relationship duration
        const duration = couple.getRelationshipDuration();

        res.status(200).json({
            success: true,
            data: {
                couple,
                relationshipDuration: duration
            }
        });

    } catch (error) {
        console.error('Get couple profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching couple profile'
        });
    }
};

// ===========================================
// Update Couple Profile
// PUT /api/couple/profile
// ===========================================

const updateCoupleProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = req.body;

        // Find couple where user is a partner
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'No couple profile found'
            });
        }

        // Fields that can be updated
        const allowedFields = [
            'coupleName', 'relationshipStatus', 'firstMeetDate', 'firstDateLocation',
            'proposalDate', 'engagementDate', 'weddingDate', 'anniversaryDate',
            'nextMeetingDate', 'distanceBetweenPartners', 'loveStory', 'couplePhoto',
            'relationshipQuestions'
        ];

        // Update allowed fields
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                couple[field] = updateData[field];
            }
        });

        await couple.save();

        // Populate partners for response
        await couple.populate('partner1', 'name nickname email avatar dateOfBirth gender phoneNumber city country bio preferences mood lastSeen');
        await couple.populate('partner2', 'name nickname email avatar dateOfBirth gender phoneNumber city country bio preferences mood lastSeen');

        res.status(200).json({
            success: true,
            message: 'Couple profile updated successfully',
            data: couple
        });

    } catch (error) {
        console.error('Update couple profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating couple profile'
        });
    }
};

// ===========================================
// Update User Profile
// PUT /api/couple/user-profile
// ===========================================

const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = req.body;
        const targetUserId = req.body.targetUserId; // Optional: to edit partner's profile

        // Determine which user to update
        let userToUpdate = userId;

        // If targeting a different user (partner), verify they're in the same couple
        if (targetUserId && targetUserId !== userId.toString()) {
            const couple = await Couple.findOne({
                $or: [{ partner1: userId }, { partner2: userId }]
            });

            if (!couple) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to edit this profile'
                });
            }

            // Check if target is the partner
            const isPartner = couple.partner1?.toString() === targetUserId || 
                             couple.partner2?.toString() === targetUserId;

            if (!isPartner) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to edit this profile'
                });
            }

            userToUpdate = targetUserId;
        }

        // Fields that can be updated
        const allowedFields = [
            'name', 'nickname', 'avatar', 'dateOfBirth', 'gender',
            'phoneNumber', 'city', 'country', 'bio', 'preferences', 'mood'
        ];

        // Build update object
        const updates = {};
        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                updates[field] = updateData[field];
            }
        });

        const user = await User.findByIdAndUpdate(
            userToUpdate,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Emit socket event to notify partner of profile update
        const io = req.app.get('io');
        if (io && targetUserId) {
            io.to(targetUserId).emit('profileUpdated', { user });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });

    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
};

// ===========================================
// Get User Profile
// GET /api/couple/user-profile
// ===========================================

const getUserProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId)
            .select('-password')
            .populate('coupleId');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile'
        });
    }
};

// ===========================================
// Update Mood
// PUT /api/couple/mood
// ===========================================

const updateMood = async (req, res) => {
    try {
        const userId = req.user._id;
        const { mood } = req.body;

        if (!mood) {
            return res.status(400).json({
                success: false,
                message: 'Mood is required'
            });
        }

        // Update user mood
        await User.findByIdAndUpdate(userId, { mood });

        // Also update mood in couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (couple) {
            if (couple.partner1.toString() === userId.toString()) {
                couple.partner1Mood = mood;
            } else {
                couple.partner2Mood = mood;
            }
            await couple.save();

            // Emit socket event to partner
            const io = req.app.get('io');
            const partnerId = couple.getPartner(userId);
            if (io && partnerId) {
                io.to(partnerId.toString()).emit('partnerMoodUpdated', { mood });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Mood updated successfully',
            data: { mood }
        });

    } catch (error) {
        console.error('Update mood error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating mood'
        });
    }
};

// ===========================================
// Add Memory
// POST /api/couple/memories
// ===========================================

const addMemory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { title, description, image, memoryDate, location, category } = req.body;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'No couple profile found'
            });
        }

        if (!image) {
            return res.status(400).json({
                success: false,
                message: 'Memory image is required'
            });
        }

        const memory = await Memory.create({
            coupleId: couple._id,
            uploadedBy: userId,
            title,
            description,
            image,
            memoryDate: memoryDate || Date.now(),
            location,
            category
        });

        await memory.populate('uploadedBy', 'name avatar');

        res.status(201).json({
            success: true,
            message: 'Memory added successfully',
            data: memory
        });

    } catch (error) {
        console.error('Add memory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding memory'
        });
    }
};

// ===========================================
// Get Memories
// GET /api/couple/memories
// ===========================================

const getMemories = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const category = req.query.category;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'No couple profile found'
            });
        }

        // Build query
        const query = { coupleId: couple._id };
        if (category && category !== 'all') {
            query.category = category;
        }

        const skip = (page - 1) * limit;
        
        const memories = await Memory.find(query)
            .sort({ memoryDate: -1 })
            .skip(skip)
            .limit(limit)
            .populate('uploadedBy', 'name avatar');
        
        const total = await Memory.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                memories,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });

    } catch (error) {
        console.error('Get memories error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching memories'
        });
    }
};

// ===========================================
// Delete Memory
// DELETE /api/couple/memories/:id
// ===========================================

const deleteMemory = async (req, res) => {
    try {
        const userId = req.user._id;
        const memoryId = req.params.id;

        // Find memory
        const memory = await Memory.findById(memoryId);

        if (!memory) {
            return res.status(404).json({
                success: false,
                message: 'Memory not found'
            });
        }

        // Find couple to verify access
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple || memory.coupleId.toString() !== couple._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this memory'
            });
        }

        await Memory.findByIdAndDelete(memoryId);

        res.status(200).json({
            success: true,
            message: 'Memory deleted successfully'
        });

    } catch (error) {
        console.error('Delete memory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting memory'
        });
    }
};

// ===========================================
// Toggle Featured Memory
// PUT /api/couple/memories/:id/feature
// ===========================================

const toggleFeatureMemory = async (req, res) => {
    try {
        const userId = req.user._id;
        const memoryId = req.params.id;

        // Find memory
        const memory = await Memory.findById(memoryId);

        if (!memory) {
            return res.status(404).json({
                success: false,
                message: 'Memory not found'
            });
        }

        // Find couple to verify access
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple || memory.coupleId.toString() !== couple._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to modify this memory'
            });
        }

        memory.isFeatured = !memory.isFeatured;
        await memory.save();

        res.status(200).json({
            success: true,
            message: memory.isFeatured ? 'Memory featured' : 'Memory unfeatured',
            data: memory
        });

    } catch (error) {
        console.error('Toggle feature memory error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating memory'
        });
    }
};

// ===========================================
// Leave Couple Space
// DELETE /api/couple/leave
// ===========================================

const leaveCouple = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'No couple profile found'
            });
        }

        // If user is partner1 and no partner2, delete the couple
        if (couple.partner1.toString() === userId.toString() && !couple.partner2) {
            await Couple.findByIdAndDelete(couple._id);
            await Memory.deleteMany({ coupleId: couple._id });
        } else {
            // Otherwise, just remove the user from the couple
            if (couple.partner1.toString() === userId.toString()) {
                // Make partner2 the new partner1
                couple.partner1 = couple.partner2;
                couple.partner2 = null;
            } else {
                couple.partner2 = null;
            }
            couple.isComplete = false;
            await couple.save();
        }

        // Remove couple reference from user
        await User.findByIdAndUpdate(userId, { coupleId: null });

        res.status(200).json({
            success: true,
            message: 'Left couple space successfully'
        });

    } catch (error) {
        console.error('Leave couple error:', error);
        res.status(500).json({
            success: false,
            message: 'Error leaving couple space'
        });
    }
};

// ===========================================
// Helper: Calculate distance between two coordinates
// Uses Haversine formula
// ===========================================

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

// ===========================================
// Update User Location
// PUT /api/couple/location
// ===========================================

const updateLocation = async (req, res) => {
    try {
        const userId = req.user._id;
        const { latitude, longitude, locationName } = req.body;

        // Validate coordinates
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        // Validate coordinate ranges
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coordinates'
            });
        }

        // Update user's location
        const user = await User.findByIdAndUpdate(
            userId,
            {
                location: {
                    latitude,
                    longitude,
                    lastUpdated: new Date(),
                    locationName: locationName || ''
                }
            },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Calculate distance if partner exists and has location
        let distance = null;
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (couple && couple.isComplete) {
            const partnerId = couple.partner1.toString() === userId.toString() 
                ? couple.partner2 
                : couple.partner1;
            
            const partner = await User.findById(partnerId);
            
            if (partner && partner.location && partner.location.latitude && partner.location.longitude) {
                distance = calculateDistance(
                    latitude, longitude,
                    partner.location.latitude, partner.location.longitude
                );

                // Update couple's distance
                couple.distanceBetweenPartners = distance;
                await couple.save();

                // Notify partner about location update
                const io = req.app.get('io');
                if (io) {
                    io.to(partnerId.toString()).emit('partnerLocationUpdated', {
                        distance,
                        partnerLocation: {
                            latitude,
                            longitude,
                            locationName
                        }
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Location updated successfully',
            data: {
                location: user.location,
                distance
            }
        });

    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating location'
        });
    }
};

// ===========================================
// Get Distance Between Partners
// GET /api/couple/distance
// ===========================================

const getDistance = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        })
        .populate('partner1', 'name location')
        .populate('partner2', 'name location');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'No couple profile found'
            });
        }

        if (!couple.isComplete) {
            return res.status(400).json({
                success: false,
                message: 'Partner has not joined yet'
            });
        }

        const partner1 = couple.partner1;
        const partner2 = couple.partner2;

        // Check if both have location data
        if (!partner1.location?.latitude || !partner2.location?.latitude) {
            return res.status(400).json({
                success: false,
                message: 'Both partners need to share their location',
                data: {
                    partner1HasLocation: !!(partner1.location?.latitude),
                    partner2HasLocation: !!(partner2.location?.latitude)
                }
            });
        }

        // Calculate distance
        const distance = calculateDistance(
            partner1.location.latitude, partner1.location.longitude,
            partner2.location.latitude, partner2.location.longitude
        );

        // Update couple's distance
        couple.distanceBetweenPartners = distance;
        await couple.save();

        res.status(200).json({
            success: true,
            data: {
                distance,
                unit: 'km',
                partner1: {
                    name: partner1.name,
                    locationName: partner1.location.locationName,
                    lastUpdated: partner1.location.lastUpdated
                },
                partner2: {
                    name: partner2.name,
                    locationName: partner2.location.locationName,
                    lastUpdated: partner2.location.lastUpdated
                }
            }
        });

    } catch (error) {
        console.error('Get distance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating distance'
        });
    }
};

module.exports = {
    createCouple,
    joinCouple,
    getCoupleProfile,
    updateCoupleProfile,
    updateUserProfile,
    getUserProfile,
    updateMood,
    addMemory,
    getMemories,
    deleteMemory,
    toggleFeatureMemory,
    leaveCouple,
    updateLocation,
    getDistance
};
