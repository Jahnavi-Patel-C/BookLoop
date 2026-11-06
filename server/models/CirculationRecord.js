const mongoose = require('mongoose');

const circulationRecordSchema = new mongoose.Schema(
  {
    borrowRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BorrowRequest',
      required: [true, 'BorrowRequest reference is required'],
      index: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required'],
      index: true,
    },
    bookTitle: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
    },
    bookAuthor: {
      type: String,
      trim: true,
      default: '',
    },
    borrowerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    borrowerName: {
      type: String,
      required: [true, 'Borrower name is required'],
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    borrowedDate: {
      type: Date,
      required: [true, 'Borrow date is required'],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    returnedDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: {
        values: ['Active', 'Returned', 'Overdue'],
        message: '{VALUE} is not a valid circulation status',
      },
      default: 'Active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

circulationRecordSchema.index({ status: 1, dueDate: 1 });
circulationRecordSchema.index({ ownerId: 1, status: 1 });
circulationRecordSchema.index({ borrowerId: 1, status: 1 });
circulationRecordSchema.index({ borrowerName: 1 });
circulationRecordSchema.index({ ownerName: 1 });

module.exports = mongoose.model('CirculationRecord', circulationRecordSchema);

