const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  claimAccount,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimiter');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many authentication attempts. Please try again later.',
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.post('/claim', authLimiter, claimAccount);

module.exports = router;

