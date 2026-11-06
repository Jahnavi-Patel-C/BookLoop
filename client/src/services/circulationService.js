import api from './api';

/**
 * Submit a new borrow request for a book.
 */
export const createBorrowRequest = async (data) => {
  const response = await api.post('/borrow-requests', data);
  return response.data;
};

/**
 * Get borrow requests with optional filters (bookId, borrowerId, ownerId, status).
 */
export const getBorrowRequests = async (params = {}) => {
  const response = await api.get('/borrow-requests', { params });
  return response.data;
};

/**
 * Get a single borrow request by ID.
 */
export const getBorrowRequest = async (id) => {
  const response = await api.get(`/borrow-requests/${id}`);
  return response.data;
};

/**
 * Approve a borrow request and set due date.
 */
export const approveBorrowRequest = async (id, dueDate) => {
  const response = await api.patch(`/borrow-requests/${id}/approve`, { dueDate });
  return response.data;
};

/**
 * Reject a borrow request.
 */
export const rejectBorrowRequest = async (id) => {
  const response = await api.patch(`/borrow-requests/${id}/reject`);
  return response.data;
};

/**
 * Mark an active loan as returned.
 */
export const returnBorrowRequest = async (id) => {
  const response = await api.patch(`/borrow-requests/${id}/return`);
  return response.data;
};

/**
 * Submit a one-time handover proposal for an approved borrowing request (Owner only).
 */
export const proposeHandover = async (id, { date, time, instructions }) => {
  const response = await api.post(`/borrow-requests/${id}/handover/propose`, { date, time, instructions });
  return response.data;
};

/**
 * Accept (YES) or decline (NO) a handover proposal (Borrower only).
 */
export const respondHandover = async (id, decision) => {
  const response = await api.patch(`/borrow-requests/${id}/handover/respond`, { decision });
  return response.data;
};

/**
 * Get circulation records with optional status and user filters.
 */
export const getCirculationRecords = async (params = {}) => {
  const response = await api.get('/circulation', { params });
  return response.data;
};

/**
 * Get overdue loans.
 */
export const getOverdueLoans = async () => {
  const response = await api.get('/circulation/overdue');
  return response.data;
};
