import api from './api';

/**
 * Register a new user
 */
export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

/**
 * Sign in user with email and password
 */
export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

/**
 * Sign out user and clear session cookie
 */
export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

/**
 * Fetch currently authenticated user profile
 */
export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

/**
 * Claim an existing demo account
 */
export const claimAccount = async (claimData) => {
  const response = await api.post('/auth/claim', claimData);
  return response.data;
};

/**
 * Fetch current user notification count (pending incoming lending requests)
 */
export const getNotificationCount = async () => {
  const response = await api.get('/notifications/count');
  return response.data;
};

