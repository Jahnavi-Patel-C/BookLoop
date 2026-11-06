import api from './api';

/**
 * Fetch notifications for authenticated user
 */
export const getNotifications = async ({ unreadOnly = false, limit = 50, page = 1 } = {}) => {
  const params = { limit, page };
  if (unreadOnly) params.unreadOnly = true;
  const response = await api.get('/notifications', { params });
  return response.data;
};

/**
 * Fetch unread notification count
 */
export const getNotificationCount = async () => {
  const response = await api.get('/notifications/count');
  return response.data;
};

/**
 * Mark a single notification as read
 */
export const markNotificationRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

/**
 * Mark all notifications as read for current user
 */
export const markAllNotificationsRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data;
};

