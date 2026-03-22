// ===========================================
// Spotify Routes
// Routes for Spotify integration
// ===========================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');
const spotifyService = require('../services/spotifyService');

// ===========================================
// GET /api/spotify/auth - Get authorization URL
// ===========================================
router.get('/auth', protect, (req, res) => {
    try {
        const platform = req.query.platform || 'web'; // 'web' or 'mobile'
        const authUrl = spotifyService.getAuthorizationUrl(req.user.id, platform);
        res.json({
            success: true,
            authUrl
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate auth URL',
            error: error.message
        });
    }
});

// ===========================================
// GET /api/spotify/callback - OAuth callback
// ===========================================
router.get('/callback', async (req, res) => {
    try {
        const { code, state, error } = req.query;
        
        // Parse state - format: "userId:platform" or just "userId" for backwards compatibility
        let userId, platform = 'web';
        if (state && state.includes(':')) {
            [userId, platform] = state.split(':');
        } else {
            userId = state;
        }
        
        // Determine redirect URL based on platform
        const getRedirectUrl = (params) => {
            if (platform === 'mobile') {
                return `justus://spotify-callback?${params}`;
            }
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return `${frontendUrl}/chat?${params}`;
        };

        if (error) {
            return res.redirect(getRedirectUrl(`spotify_error=${error}`));
        }

        if (!code || !userId) {
            return res.redirect(getRedirectUrl('spotify_error=missing_params'));
        }

        // Exchange code for tokens
        const tokens = await spotifyService.exchangeCodeForTokens(code);

        // Get user's Spotify profile
        const profile = await spotifyService.getSpotifyProfile(tokens.accessToken);

        // Update user with Spotify data
        await User.findByIdAndUpdate(userId, {
            'spotify.connected': true,
            'spotify.accessToken': tokens.accessToken,
            'spotify.refreshToken': tokens.refreshToken,
            'spotify.tokenExpiry': new Date(Date.now() + tokens.expiresIn * 1000),
            'spotify.spotifyId': profile.id,
            'spotify.displayName': profile.displayName,
            'spotify.profileUrl': profile.profileUrl
        });

        // Redirect back to frontend with success
        res.redirect(getRedirectUrl('spotify_connected=true'));
    } catch (error) {
        console.error('Spotify callback error:', error);
        res.redirect(getRedirectUrl('spotify_error=auth_failed'));
    }
});

// ===========================================
// GET /api/spotify/status - Check connection status
// ===========================================
router.get('/status', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        res.json({
            success: true,
            connected: user.spotify?.connected || false,
            displayName: user.spotify?.displayName || null,
            profileUrl: user.spotify?.profileUrl || null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get Spotify status',
            error: error.message
        });
    }
});

// ===========================================
// POST /api/spotify/disconnect - Disconnect Spotify
// ===========================================
router.post('/disconnect', protect, async (req, res) => {
    try {
        await spotifyService.disconnectSpotify(req.user.id);
        
        res.json({
            success: true,
            message: 'Spotify disconnected'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to disconnect Spotify',
            error: error.message
        });
    }
});

// ===========================================
// GET /api/spotify/search - Search tracks
// ===========================================
router.get('/search', protect, async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const tracks = await spotifyService.searchTracks(req.user.id, q, parseInt(limit));
        
        res.json({
            success: true,
            tracks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to search tracks',
            error: error.message
        });
    }
});

// ===========================================
// GET /api/spotify/track/:id - Get track details
// ===========================================
router.get('/track/:id', protect, async (req, res) => {
    try {
        const track = await spotifyService.getTrack(req.user.id, req.params.id);
        
        res.json({
            success: true,
            track
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get track',
            error: error.message
        });
    }
});

// ===========================================
// GET /api/spotify/playback - Get playback state
// ===========================================
router.get('/playback', protect, async (req, res) => {
    try {
        const playback = await spotifyService.getPlaybackState(req.user.id);
        
        res.json({
            success: true,
            playback
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get playback state',
            error: error.message
        });
    }
});

// ===========================================
// PUT /api/spotify/play - Start playback
// ===========================================
router.put('/play', protect, async (req, res) => {
    try {
        const { spotifyUri, positionMs = 0 } = req.body;
        
        await spotifyService.startPlayback(req.user.id, spotifyUri, positionMs);
        
        res.json({
            success: true,
            message: 'Playback started'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to start playback',
            error: error.message
        });
    }
});

// ===========================================
// PUT /api/spotify/pause - Pause playback
// ===========================================
router.put('/pause', protect, async (req, res) => {
    try {
        await spotifyService.pausePlayback(req.user.id);
        
        res.json({
            success: true,
            message: 'Playback paused'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to pause playback',
            error: error.message
        });
    }
});

// ===========================================
// PUT /api/spotify/seek - Seek to position
// ===========================================
router.put('/seek', protect, async (req, res) => {
    try {
        const { positionMs } = req.body;
        
        if (positionMs === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Position is required'
            });
        }

        await spotifyService.seekToPosition(req.user.id, positionMs);
        
        res.json({
            success: true,
            message: 'Seek successful'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to seek',
            error: error.message
        });
    }
});

// ===========================================
// GET /api/spotify/devices - Get available devices
// ===========================================
router.get('/devices', protect, async (req, res) => {
    try {
        const devices = await spotifyService.getDevices(req.user.id);
        
        res.json({
            success: true,
            devices
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get devices',
            error: error.message
        });
    }
});

// ===========================================
// PUT /api/spotify/transfer - Transfer playback
// ===========================================
router.put('/transfer', protect, async (req, res) => {
    try {
        const { deviceId } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Device ID is required'
            });
        }

        await spotifyService.transferPlayback(req.user.id, deviceId);
        
        res.json({
            success: true,
            message: 'Playback transferred'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to transfer playback',
            error: error.message
        });
    }
});

module.exports = router;
