const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient userId is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: [
          'BORROW_REQUEST_RECEIVED',
          'BORROW_REQUEST_APPROVED',
          'BORROW_REQUEST_REJECTED',
          'DUE_DATE_APPROACHING',
          'LOAN_OVERDUE',
          'BOOK_RETURNED',
          'HANDOVER_PROPOSED',
          'HANDOVER_ACCEPTED',
          'HANDOVER_DECLINED',
        ],
        message: '{VALUE} is not a valid notification type',
      },
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    relatedBookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      index: true,
    },
    relatedRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BorrowRequest',
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal queries and deduplication checks
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, relatedRequestId: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

