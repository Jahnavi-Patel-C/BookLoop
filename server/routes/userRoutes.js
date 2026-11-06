const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  getDashboardStats,
} = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/profile', getUserProfile);
router.patch('/profile', updateUserProfile);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;

