// ===========================================
// justUS Backend Server
// Main entry point for the application
// ===========================================

// Import required packages
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Create Express app
const app = express();

// Create HTTP server (needed for Socket.io)
const server = http.createServer(app);

// ===========================================
// Middleware Setup
// ===========================================

// Enable CORS - allows frontend and mobile apps to communicate with backend
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // In production, allow all origins for mobile app support
        // Mobile apps don't send origin header consistently
        if (process.env.NODE_ENV === 'production') {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins in development
        }
    },
    credentials: true
}));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files as static files with proper headers for mobile audio playback
app.use('/uploads', (req, res, next) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    
    // Enable byte-range requests for audio/video streaming
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Set proper content types for audio files
    const ext = path.extname(req.path).toLowerCase();
    const mimeTypes = {
        '.webm': 'audio/webm',
        '.mp4': 'audio/mp4',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav'
    };
    
    if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
    }
    
    next();
}, express.static(path.join(__dirname, 'uploads')));

// Handle favicon requests to prevent proxy errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ===========================================
// Database Connection
// ===========================================

// Connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1); // Exit process with failure
    }
};

// ===========================================
// Socket.io Setup
// ===========================================

// Initialize Socket.io with CORS settings
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Make io accessible to routes
app.set('io', io);

// ===========================================
// Import Routes
// ===========================================

const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
// Use cloud upload routes (auto-switches between local/Cloudinary based on env)
const uploadRoutes = require('./routes/cloudUploadRoutes');
const callRoutes = require('./routes/callRoutes');
const coupleRoutes = require('./routes/coupleRoutes');
const savedMessageRoutes = require('./routes/savedMessageRoutes');
const dailyQuestionRoutes = require('./routes/dailyQuestionRoutes');
const timelineRoutes = require('./routes/timelineRoutes');
const loveLetterRoutes = require('./routes/loveLetterRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const scheduledMessageRoutes = require('./routes/scheduledMessageRoutes');
const loveMeterRoutes = require('./routes/loveMeterRoutes');
const memoryMapRoutes = require('./routes/memoryMapRoutes');
const quizRoutes = require('./routes/quizRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const moodRoutes = require('./routes/moodRoutes');
const lockRoutes = require('./routes/lockRoutes');
const streakRoutes = require('./routes/streakRoutes');
const loveStoryRoutes = require('./routes/loveStoryRoutes');
const coupleThemeRoutes = require('./routes/coupleThemeRoutes');
const transcriptionRoutes = require('./routes/transcriptionRoutes');
const coupleGoalRoutes = require('./routes/coupleGoalRoutes');
const activityHeatmapRoutes = require('./routes/activityHeatmapRoutes');
const silentCareRoutes = require('./routes/silentCareRoutes');

// ===========================================
// Import Socket Handler
// ===========================================

const { initializeSocket } = require('./sockets/socketHandler');
const { startScheduler } = require('./services/messageScheduler');

// Initialize socket handlers with authentication
initializeSocket(io);

// Store io globally for services (like transcription)
global.io = io;

// ===========================================
// Routes
// ===========================================

// Health check route - verify server is running
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to justUS API',
        status: 'Server is running',
        version: '1.0.0'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/couple', coupleRoutes);
app.use('/api/saved-messages', savedMessageRoutes);
app.use('/api/daily-question', dailyQuestionRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/love-letters', loveLetterRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/scheduled-messages', scheduledMessageRoutes);
app.use('/api/love-meter', loveMeterRoutes);
app.use('/api/memory-map', memoryMapRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/playlist', playlistRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/lock', lockRoutes);
app.use('/api/streak', streakRoutes);
app.use('/api/love-story', loveStoryRoutes);
app.use('/api/couple-theme', coupleThemeRoutes);
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/couple-goals', coupleGoalRoutes);
app.use('/api/activity-heatmap', activityHeatmapRoutes);
app.use('/api/silent-care', silentCareRoutes);

// ===========================================
// Error Handling Middleware
// ===========================================

// Handle 404 errors - route not found
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// ===========================================
// Start Server
// ===========================================

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces for mobile access

// Connect to database, then start server
connectDB().then(() => {
    server.listen(PORT, HOST, () => {
        console.log('===========================================');
        console.log(`🚀 justUS Server running on port ${PORT}`);
        console.log(`📡 API URL: http://localhost:${PORT}`);
        console.log(`📱 Mobile URL: http://10.247.230.173:${PORT}`);
        console.log(`🔌 Socket.io ready for connections`);
        console.log('===========================================');
        
        // Start the message scheduler
        startScheduler(io);
    });
});

// Export for testing purposes
module.exports = { app, server, io };
