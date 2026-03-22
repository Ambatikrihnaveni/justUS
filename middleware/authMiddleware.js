// ===========================================
// Authentication Middleware
// Protects routes that require login
// ===========================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token and attach user to request
const protect = async (req, res, next) => {
    try {
        let token;

        // Check if token exists in Authorization header
        // Format: "Bearer <token>"
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            // Extract token from header
            token = req.headers.authorization.split(' ')[1];
        }

        // If no token found, deny access
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized. Please login to access this route.'
            });
        }

        try {
            // Verify the token using our secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Find the user and attach to request object
            // Exclude password from the result
            req.user = await User.findById(decoded.userId).select('-password');

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found. Token may be invalid.'
                });
            }

            // Note: lastSeen is now only updated on socket disconnect (socketHandler.js)
            // This ensures lastSeen reflects when user actually went offline, not last API activity

            // Continue to the next middleware/route
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please login again.'
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error in authentication'
        });
    }
};

module.exports = { protect };
