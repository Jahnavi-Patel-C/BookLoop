const Notification = require('../models/Notification');
const { emitToUser } = require('./socketService');

/**
 * Create a persistent notification in MongoDB and emit real-time event via Socket.IO
 *
 * @param {Object} options
 * @param {String|ObjectId} options.userId - Recipient user ID
 * @param {String} options.type - Notification enum type
 * @param {String} options.title - Short descriptive title
 * @param {String} options.message - Detailed explanation
 * @param {String|ObjectId} [options.relatedBookId] - Associated book ID
 * @param {String|ObjectId} [options.relatedRequestId] - Associated borrow request ID
 * @param {Boolean} [options.checkDuplicate=false] - Prevent duplicate notification for same user, type, and request
 * @returns {Promise<Document|null>} Created notification document
 */
const createNotification = async ({
  userId,
  type,
  title,
  message,
  relatedBookId,
  relatedRequestId,
  checkDuplicate = false,
}) => {
  if (!userId || !type || !title || !message) {
    throw new Error('userId, type, title, and message are required to create a notification');
  }

  // Prevent duplicate notifications when requested (e.g. for reminders and overdue alerts)
  if (checkDuplicate && relatedRequestId) {
    const existing = await Notification.findOne({
      userId,
      type,
      relatedRequestId,
    });
    if (existing) {
      return existing;
    }
  }

  // 1. Persist notification in MongoDB
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    relatedBookId,
    relatedRequestId,
    isRead: false,
  });

  // 2. Emit real-time notification to user's private socket room
  try {
    emitToUser(userId, 'notification:new', notification);
    // Also broadcast updated unread count
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });
    emitToUser(userId, 'notification:count', { unreadCount });
  } catch (err) {
    console.warn(`[notificationService] Socket emission error: ${err.message}`);
  }

  return notification;
};

module.exports = {
  createNotification,
};

