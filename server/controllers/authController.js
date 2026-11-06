const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'bookloop_jwt_secret_editorial_2026_secure_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || (isProd ? 'none' : 'lax');
const COOKIE_SECURE = isProd || COOKIE_SAME_SITE === 'none';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Generate a JWT token for a user ID
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Send token in HTTP-only cookie and return safe user response
 */
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = generateToken(user._id);

  res.cookie('token', token, COOKIE_OPTIONS);

  return res.status(statusCode).json({
    success: true,
    message: message || 'Authentication successful',
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      neighborhood: user.neighborhood || '',
      createdAt: user.createdAt,
    },
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, neighborhood } = req.body;
    const errors = [];

    // Validation
    if (!name || !name.trim()) {
      errors.push('Full name is required');
    } else if (name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    } else if (name.trim().length > 50) {
      errors.push('Name cannot exceed 50 characters');
    }

    if (!email || !email.trim()) {
      errors.push('Email address is required');
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        errors.push('Please provide a valid email address');
      }
    }

    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one letter and one number');
      }
    }

    if (password && confirmPassword && password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0],
        messages: errors,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists',
      });
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'user',
      neighborhood: neighborhood ? neighborhood.trim() : '',
      isClaimed: true,
    });

    sendTokenResponse(user, 201, res, 'Account registered successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user with email and password
 * @route   POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user with password hash included
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    // Generic response for security (mitigate user enumeration)
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    sendTokenResponse(user, 200, res, 'Signed in successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user by clearing session cookie
 * @route   POST /api/auth/logout
 */
const logout = async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: '/',
    expires: new Date(0), // Immediate expiration
  });

  res.status(200).json({
    success: true,
    message: 'Signed out successfully',
  });
};

/**
 * @desc    Get currently authenticated user's profile
 * @route   GET /api/auth/me
 */
const getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      neighborhood: req.user.neighborhood || '',
      createdAt: req.user.createdAt,
    },
  });
};

/**
 * @desc    Claim an unclaimed demo account and establish password
 * @route   POST /api/auth/claim
 */
const claimAccount = async (req, res, next) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and new password',
      });
    }

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters with at least one letter and one number',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match',
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    user.password = newPassword;
    user.isClaimed = true;
    await user.save();

    sendTokenResponse(user, 200, res, 'Account claimed and password configured successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  claimAccount,
};

