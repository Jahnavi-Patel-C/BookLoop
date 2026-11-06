const Notification = require('../models/Notification');
const BorrowRequest = require('../models/BorrowRequest');
const { emitToUser } = require('../services/socketService');

/**
 * @desc    Get user's notifications with optional unread filter
 * @route   GET /api/notifications
 * @query   unreadOnly (boolean), limit (number), page (number)
 */
const getNotifications = async (req, res, next) => {
  try {
    const { unreadOnly, limit = 50, page = 1 } = req.query;
    const query = { userId: req.user._id };

    if (unreadOnly === 'true' || unreadOnly === true) {
      query.isRead = false;
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('relatedBookId', 'title author genre coverImage availability')
        .populate('relatedRequestId', 'status dueDate requestedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      page: parsedPage,
      pages: Math.ceil(total / parsedLimit),
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread notification count for active user
 * @route   GET /api/notifications/count
 */
const getNotificationCount = async (req, res, next) => {
  try {
    const [unreadCount, pendingLendingRequests] = await Promise.all([
      Notification.countDocuments({
        userId: req.user._id,
        isRead: false,
      }),
      BorrowRequest.countDocuments({
        ownerId: req.user._id,
        status: 'Pending',
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
        pendingLendingRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      });
    }

    // Authorization: User can only mark their own notification as read
    if (!notification.userId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to modify this notification',
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      // Emit updated unread count to user socket
      const unreadCount = await Notification.countDocuments({
        userId: req.user._id,
        isRead: false,
      });
      emitToUser(req.user._id, 'notification:count', { unreadCount });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all unread notifications as read for active user
 * @route   PATCH /api/notifications/read-all
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: now } }
    );

    // Emit updated unread count (0)
    emitToUser(req.user._id, 'notification:count', { unreadCount: 0 });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
};
