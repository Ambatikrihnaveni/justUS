// ===========================================
// Spotify Service
// Handles Spotify API interactions
// ===========================================

const axios = require('axios');
const User = require('../models/User');

// Spotify API endpoints
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// Required scopes for our app
const SCOPES = [
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'playlist-read-private',
    'playlist-read-collaborative'
].join(' ');

// ===========================================
// Generate Authorization URL
// ===========================================
const getAuthorizationUrl = (userId, platform = 'web') => {
    const params = new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        scope: SCOPES,
        state: `${userId}:${platform}`, // Pass userId and platform to link account after auth
        show_dialog: true
    });

    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
};

// ===========================================
// Exchange Code for Tokens
// ===========================================
const exchangeCodeForTokens = async (code) => {
    try {
        const response = await axios.post(SPOTIFY_TOKEN_URL, 
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.SPOTIFY_REDIRECT_URI
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                    ).toString('base64')
                }
            }
        );

        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresIn: response.data.expires_in
        };
    } catch (error) {
        console.error('Spotify token exchange error:', error.response?.data || error.message);
        throw new Error('Failed to exchange code for tokens');
    }
};

// ===========================================
// Refresh Access Token
// ===========================================
const refreshAccessToken = async (refreshToken) => {
    try {
        const response = await axios.post(SPOTIFY_TOKEN_URL,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                    ).toString('base64')
                }
            }
        );

        return {
            accessToken: response.data.access_token,
            expiresIn: response.data.expires_in
        };
    } catch (error) {
        console.error('Spotify token refresh error:', error.response?.data || error.message);
        throw new Error('Failed to refresh token');
    }
};

// ===========================================
// Get Valid Access Token (Auto-refresh if needed)
// ===========================================
const getValidAccessToken = async (userId) => {
    const user = await User.findById(userId);
    
    if (!user || !user.spotify?.connected) {
        throw new Error('Spotify not connected');
    }

    // Check if token is expired (with 5 min buffer)
    const now = new Date();
    const tokenExpiry = new Date(user.spotify.tokenExpiry);
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (now.getTime() > tokenExpiry.getTime() - bufferTime) {
        // Token expired or about to expire, refresh it
        const newTokens = await refreshAccessToken(user.spotify.refreshToken);
        
        // Update user with new token
        user.spotify.accessToken = newTokens.accessToken;
        user.spotify.tokenExpiry = new Date(Date.now() + newTokens.expiresIn * 1000);
        await user.save();

        return newTokens.accessToken;
    }

    return user.spotify.accessToken;
};

// ===========================================
// Get User's Spotify Profile
// ===========================================
const getSpotifyProfile = async (accessToken) => {
    try {
        const response = await axios.get(`${SPOTIFY_API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        return {
            id: response.data.id,
            displayName: response.data.display_name,
            email: response.data.email,
            profileUrl: response.data.external_urls?.spotify,
            images: response.data.images
        };
    } catch (error) {
        console.error('Get Spotify profile error:', error.response?.data || error.message);
        throw new Error('Failed to get Spotify profile');
    }
};

// ===========================================
// Search Tracks
// ===========================================
const searchTracks = async (userId, query, limit = 10) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        const response = await axios.get(`${SPOTIFY_API_URL}/search`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: {
                q: query,
                type: 'track',
                limit
            }
        });

        return response.data.tracks.items.map(track => ({
            spotifyId: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            albumArt: track.album.images[0]?.url || null,
            duration: track.duration_ms,
            previewUrl: track.preview_url,
            spotifyUri: track.uri,
            externalUrl: track.external_urls.spotify
        }));
    } catch (error) {
        console.error('Spotify search error:', error.response?.data || error.message);
        throw new Error('Failed to search tracks');
    }
};

// ===========================================
// Get Track Details
// ===========================================
const getTrack = async (userId, trackId) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        const response = await axios.get(`${SPOTIFY_API_URL}/tracks/${trackId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const track = response.data;
        return {
            spotifyId: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            albumArt: track.album.images[0]?.url || null,
            duration: track.duration_ms,
            previewUrl: track.preview_url,
            spotifyUri: track.uri,
            externalUrl: track.external_urls.spotify
        };
    } catch (error) {
        console.error('Get track error:', error.response?.data || error.message);
        throw new Error('Failed to get track');
    }
};

// ===========================================
// Get Current Playback State
// ===========================================
const getPlaybackState = async (userId) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        const response = await axios.get(`${SPOTIFY_API_URL}/me/player`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.data || response.status === 204) {
            return null; // No active device
        }

        return {
            isPlaying: response.data.is_playing,
            progress: response.data.progress_ms,
            track: response.data.item ? {
                spotifyId: response.data.item.id,
                title: response.data.item.name,
                artist: response.data.item.artists.map(a => a.name).join(', '),
                albumArt: response.data.item.album.images[0]?.url,
                duration: response.data.item.duration_ms,
                spotifyUri: response.data.item.uri
            } : null,
            device: response.data.device ? {
                id: response.data.device.id,
                name: response.data.device.name,
                type: response.data.device.type,
                isActive: response.data.device.is_active
            } : null
        };
    } catch (error) {
        if (error.response?.status === 204) {
            return null;
        }
        console.error('Get playback state error:', error.response?.data || error.message);
        throw new Error('Failed to get playback state');
    }
};

// ===========================================
// Start/Resume Playback
// ===========================================
const startPlayback = async (userId, spotifyUri, positionMs = 0) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        const body = {};
        if (spotifyUri) {
            body.uris = [spotifyUri];
            body.position_ms = positionMs;
        }

        await axios.put(`${SPOTIFY_API_URL}/me/player/play`, body, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        return { success: true };
    } catch (error) {
        console.error('Start playback error:', error.response?.data || error.message);
        throw new Error('Failed to start playback');
    }
};

// ===========================================
// Pause Playback
// ===========================================
const pausePlayback = async (userId) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        await axios.put(`${SPOTIFY_API_URL}/me/player/pause`, {}, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        return { success: true };
    } catch (error) {
        console.error('Pause playback error:', error.response?.data || error.message);
        throw new Error('Failed to pause playback');
    }
};

// ===========================================
// Seek to Position
// ===========================================
const seekToPosition = async (userId, positionMs) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        await axios.put(`${SPOTIFY_API_URL}/me/player/seek`, null, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: { position_ms: positionMs }
        });

        return { success: true };
    } catch (error) {
        console.error('Seek error:', error.response?.data || error.message);
        throw new Error('Failed to seek');
    }
};

// ===========================================
// Get Available Devices
// ===========================================
const getDevices = async (userId) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        const response = await axios.get(`${SPOTIFY_API_URL}/me/player/devices`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        return response.data.devices.map(device => ({
            id: device.id,
            name: device.name,
            type: device.type,
            isActive: device.is_active,
            volume: device.volume_percent
        }));
    } catch (error) {
        console.error('Get devices error:', error.response?.data || error.message);
        throw new Error('Failed to get devices');
    }
};

// ===========================================
// Transfer Playback to Device
// ===========================================
const transferPlayback = async (userId, deviceId) => {
    try {
        const accessToken = await getValidAccessToken(userId);
        
        await axios.put(`${SPOTIFY_API_URL}/me/player`, 
            { device_ids: [deviceId], play: true },
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        return { success: true };
    } catch (error) {
        console.error('Transfer playback error:', error.response?.data || error.message);
        throw new Error('Failed to transfer playback');
    }
};

// ===========================================
// Disconnect Spotify
// ===========================================
const disconnectSpotify = async (userId) => {
    try {
        await User.findByIdAndUpdate(userId, {
            'spotify.connected': false,
            'spotify.accessToken': null,
            'spotify.refreshToken': null,
            'spotify.tokenExpiry': null,
            'spotify.spotifyId': null,
            'spotify.displayName': null,
            'spotify.profileUrl': null
        });

        return { success: true };
    } catch (error) {
        console.error('Disconnect Spotify error:', error.message);
        throw new Error('Failed to disconnect Spotify');
    }
};

module.exports = {
    getAuthorizationUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getValidAccessToken,
    getSpotifyProfile,
    searchTracks,
    getTrack,
    getPlaybackState,
    startPlayback,
    pausePlayback,
    seekToPosition,
    getDevices,
    transferPlayback,
    disconnectSpotify
};
