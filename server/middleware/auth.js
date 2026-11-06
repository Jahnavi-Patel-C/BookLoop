const jwt = require('jsonwebtoken');
const User = require('../models/User');

const { JWT_SECRET } = require('../config/jwt');

/**
 * Non-blocking middleware to authenticate user from HTTP-only cookie
 * (or optional Authorization header for API testing).
 * Attaches req.user if valid; otherwise req.user = null.
 */
const authenticateUser = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HTTP-only cookie first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Fallback to Authorization: Bearer <token>
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      req.user = null;
      return next();
    }

    // Load user without password
    const user = await User.findById(decoded.id).select('-password');
    req.user = user || null;
    next();
  } catch (error) {
    // Expired or invalid token
    req.user = null;
    next();
  }
};

/**
 * Blocking middleware to require authentication.
 * Returns 401 Unauthorized if user is not authenticated.
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.',
    });
  }
  next();
};

module.exports = {
  authenticateUser,
  requireAuth,
};

