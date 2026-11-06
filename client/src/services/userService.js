import api from './api';

/**
 * Fetch authenticated user profile & circulation tallies
 */
export const getUserProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data;
};

/**
 * Update authenticated user's profile (name & optional neighbourhood)
 */
export const updateUserProfile = async (data) => {
  const payload = typeof data === 'string' ? { name: data } : data;
  const response = await api.patch('/users/profile', payload);
  return response.data;
};

/**
 * Fetch personalized live dashboard statistics
 */
export const getDashboardStats = async () => {
  const response = await api.get('/users/dashboard-stats');
  return response.data;
};

