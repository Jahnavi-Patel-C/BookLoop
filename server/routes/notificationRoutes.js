const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', getNotifications);
router.get('/count', getNotificationCount);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.post('/trigger-reminders', async (req, res, next) => {
  try {
    const { checkReminders } = require('../services/reminderScheduler');
    await checkReminders();
    res.status(200).json({ success: true, message: 'Reminders processed successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
