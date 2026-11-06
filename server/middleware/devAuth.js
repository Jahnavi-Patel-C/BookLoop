const mongoose = require('mongoose');
const DevUser = require('../models/DevUser');

/**
 * Middleware to resolve the development user identity from the X-Dev-User-Id header.
 * Non-blocking: attaches req.user if found, otherwise req.user = null.
 */
const resolveDevUser = async (req, res, next) => {
  try {
    const devUserId = req.headers['x-dev-user-id'];

    if (!devUserId || !mongoose.Types.ObjectId.isValid(devUserId)) {
      req.user = null;
      return next();
    }

    const user = await DevUser.findOne({ _id: devUserId, isActive: true });
    req.user = user || null;
    next();
  } catch (error) {
    console.error(`[devAuth] Error resolving user: ${error.message}`);
    req.user = null;
    next();
  }
};

/**
 * Middleware to require a valid development user identity on protected routes.
 */
const requireDevUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Development user identity required. Please select a user or provide X-Dev-User-Id header.',
    });
  }
  next();
};

module.exports = {
  resolveDevUser,
  requireDevUser,
};

