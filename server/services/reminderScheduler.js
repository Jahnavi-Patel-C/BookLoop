const BorrowRequest = require('../models/BorrowRequest');
const Book = require('../models/Book');
const { createNotification } = require('./notificationService');

/**
 * Check for approaching due dates and overdue loans.
 * Safe, idempotent, and prevents duplicate alerts.
 */
const checkReminders = async () => {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // -------------------------------------------------------------
    // 1. Approaching Due Date Reminders (within next 24 hours)
    // -------------------------------------------------------------
    const approachingLoans = await BorrowRequest.find({
      status: 'Approved',
      dueDate: { $gt: now, $lte: in24Hours },
    }).populate('bookId', 'title');

    for (const req of approachingLoans) {
      if (req.borrowerId) {
        const bookTitle = req.bookId?.title || 'Borrowed Volume';
        const formattedDueDate = new Date(req.dueDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        await createNotification({
          userId: req.borrowerId,
          type: 'DUE_DATE_APPROACHING',
          title: 'Return Due Soon',
          message: `Reminder: "${bookTitle}" is due for return on ${formattedDueDate} (within 24 hours).`,
          relatedBookId: req.bookId?._id || req.bookId,
          relatedRequestId: req._id,
          checkDuplicate: true,
        });
      }
    }

    // -------------------------------------------------------------
    // 2. Overdue Loan Alerts (dueDate has passed, still Approved)
    // -------------------------------------------------------------
    const overdueLoans = await BorrowRequest.find({
      status: 'Approved',
      dueDate: { $lt: now },
    }).populate('bookId', 'title');

    for (const req of overdueLoans) {
      const bookTitle = req.bookId?.title || 'Borrowed Volume';
      const formattedDueDate = new Date(req.dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      // Notify borrower
      if (req.borrowerId) {
        await createNotification({
          userId: req.borrowerId,
          type: 'LOAN_OVERDUE',
          title: 'Book Loan Overdue',
          message: `Notice: "${bookTitle}" was due on ${formattedDueDate} and is now overdue. Please arrange return with the owner.`,
          relatedBookId: req.bookId?._id || req.bookId,
          relatedRequestId: req._id,
          checkDuplicate: true,
        });
      }

      // Notify owner
      if (req.ownerId) {
        await createNotification({
          userId: req.ownerId,
          type: 'LOAN_OVERDUE',
          title: 'Loan Overdue Alert',
          message: `Notice: "${bookTitle}" on loan to ${req.borrowerName} was due on ${formattedDueDate} and is now overdue.`,
          relatedBookId: req.bookId?._id || req.bookId,
          relatedRequestId: req._id,
          checkDuplicate: true,
        });
      }
    }
  } catch (err) {
    console.error(`[reminderScheduler] Error processing reminders: ${err.message}`);
  }
};

/**
 * Start periodic scheduler (runs every 15 minutes + initial run)
 */
const startScheduler = (intervalMs = 15 * 60 * 1000) => {
  // Run once after server boots up
  setTimeout(checkReminders, 5000);

  // Periodic interval
  const timer = setInterval(checkReminders, intervalMs);
  return timer;
};

module.exports = {
  checkReminders,
  startScheduler,
};

