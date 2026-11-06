const express = require('express');
const router = express.Router();
const {
  createBorrowRequest,
  getBorrowRequests,
  getBorrowRequest,
  approveBorrowRequest,
  rejectBorrowRequest,
  returnBorrowRequest,
  getCirculationRecords,
  getOverdueLoans,
  proposeHandover,
  respondHandover,
} = require('../controllers/circulationController');
const { requireAuth } = require('../middleware/auth');

// Borrow Requests routes
router.route('/borrow-requests')
  .post(requireAuth, createBorrowRequest)
  .get(getBorrowRequests);

router.route('/borrow-requests/:id')
  .get(getBorrowRequest);

router.patch('/borrow-requests/:id/approve', requireAuth, approveBorrowRequest);
router.patch('/borrow-requests/:id/reject', requireAuth, rejectBorrowRequest);
router.patch('/borrow-requests/:id/return', requireAuth, returnBorrowRequest);

// Handover Coordination routes (Phase 8)
router.post('/borrow-requests/:id/handover/propose', requireAuth, proposeHandover);
router.patch('/borrow-requests/:id/handover/respond', requireAuth, respondHandover);

// Circulation routes
router.get('/circulation', getCirculationRecords);
router.get('/circulation/overdue', getOverdueLoans);

module.exports = router;
