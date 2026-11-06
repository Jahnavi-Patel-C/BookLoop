import api from './api';

/**
 * Fetch all active dev users.
 */
export const getDevUsers = async () => {
  const response = await api.get('/dev-users');
  return response.data;
};

/**
 * Fetch currently active dev user from session header.
 */
export const getCurrentDevUser = async () => {
  const response = await api.get('/dev-users/current');
  return response.data;
};

/**
 * Fetch current user notification count (pending incoming lending requests).
 */
export const getNotificationCount = async () => {
  const response = await api.get('/notifications/count');
  return response.data;
};

