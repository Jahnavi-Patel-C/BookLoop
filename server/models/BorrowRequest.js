const mongoose = require('mongoose');

const borrowRequestSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required'],
      index: true,
    },
    borrowerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    borrowerName: {
      type: String,
      required: [true, 'Borrower display name is required'],
      trim: true,
      maxlength: [50, 'Borrower name cannot exceed 50 characters'],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner display name is required'],
      trim: true,
      maxlength: [50, 'Owner name cannot exceed 50 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'Approved', 'Rejected', 'Returned'],
        message: '{VALUE} is not a valid borrow request status',
      },
      default: 'Pending',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    returnedAt: {
      type: Date,
    },
    handover: {
      status: {
        type: String,
        enum: {
          values: ['Unproposed', 'Proposed', 'Accepted', 'Declined'],
          message: '{VALUE} is not a valid handover status',
        },
        default: 'Unproposed',
        index: true,
      },
      proposedDate: {
        type: Date,
      },
      proposedTime: {
        type: String,
        trim: true,
      },
      instructions: {
        type: String,
        trim: true,
        maxlength: [500, 'Handover instructions cannot exceed 500 characters'],
        default: '',
      },
      proposedAt: {
        type: Date,
      },
      respondedAt: {
        type: Date,
      },
      rescheduleCount: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indices for fast queries and duplicate prevention
borrowRequestSchema.index({ ownerId: 1, status: 1 });
borrowRequestSchema.index({ borrowerId: 1, status: 1 });
borrowRequestSchema.index({ bookId: 1, borrowerId: 1, status: 1 });
borrowRequestSchema.index({ bookId: 1, borrowerName: 1, status: 1 });
borrowRequestSchema.index({ ownerName: 1, status: 1 });
borrowRequestSchema.index({ borrowerName: 1, status: 1 });

module.exports = mongoose.model('BorrowRequest', borrowRequestSchema);

