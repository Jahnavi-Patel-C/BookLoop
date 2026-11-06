const DevUser = require('../models/DevUser');

/**
 * @desc    Get all available development demo users
 * @route   GET /api/dev-users
 */
const getDevUsers = async (req, res, next) => {
  try {
    const users = await DevUser.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get the currently active development user based on request context
 * @route   GET /api/dev-users/current
 */
const getCurrentDevUser = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No active development identity resolved',
      });
    }

    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDevUsers,
  getCurrentDevUser,
};

