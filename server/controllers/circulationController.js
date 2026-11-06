const BorrowRequest = require('../models/BorrowRequest');
const CirculationRecord = require('../models/CirculationRecord');
const Book = require('../models/Book');
const { createNotification } = require('../services/notificationService');

/**
 * @desc    Submit a borrowing request for a book
 * @route   POST /api/borrow-requests
 */
const createBorrowRequest = async (req, res, next) => {
  try {
    const { bookId, borrowerName, notes } = req.body;

    if (!bookId) {
      return res.status(400).json({ success: false, error: 'Book ID is required' });
    }

    // Derive borrower identity from authenticated dev user when available
    const borrowerId = req.user ? req.user._id : undefined;
    const resolvedBorrowerName = req.user ? req.user.name : (borrowerName ? borrowerName.trim() : '');

    if (!resolvedBorrowerName) {
      return res.status(400).json({ success: false, error: 'Borrower display name is required' });
    }

    // 1. Fetch the book
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found' });
    }

    // 2. Rule: Owners cannot borrow their own books
    const isOwnerById = book.ownerId && req.user && book.ownerId.equals(req.user._id);
    const isOwnerByName = book.ownerName && book.ownerName.toLowerCase().trim() === resolvedBorrowerName.toLowerCase().trim();

    if (isOwnerById || isOwnerByName) {
      return res.status(400).json({
        success: false,
        error: 'You cannot borrow a book that you own',
      });
    }

    // 3. Rule: Check book availability
    if (!book.availability) {
      return res.status(400).json({
        success: false,
        error: 'This book is currently unavailable for borrowing',
      });
    }

    // 4. Rule: A borrower cannot submit duplicate active requests for the same book
    const duplicateQuery = {
      bookId: book._id,
      status: { $in: ['Pending', 'Approved'] },
    };

    if (borrowerId) {
      duplicateQuery.$or = [
        { borrowerId },
        { borrowerName: new RegExp(`^${resolvedBorrowerName}$`, 'i') },
      ];
    } else {
      duplicateQuery.borrowerName = new RegExp(`^${resolvedBorrowerName}$`, 'i');
    }

    const existingActiveRequest = await BorrowRequest.findOne(duplicateQuery);

    if (existingActiveRequest) {
      return res.status(400).json({
        success: false,
        error: `You already have an active (${existingActiveRequest.status.toLowerCase()}) request for this book`,
      });
    }

    // 5. Create pending request (pending request does NOT mark book unavailable)
    const request = await BorrowRequest.create({
      bookId: book._id,
      borrowerId,
      borrowerName: resolvedBorrowerName,
      ownerId: book.ownerId,
      ownerName: book.ownerName,
      notes: notes ? notes.trim() : '',
      status: 'Pending',
      requestedAt: new Date(),
    });

    // Notify book owner about new borrowing request
    if (book.ownerId) {
      try {
        await createNotification({
          userId: book.ownerId,
          type: 'BORROW_REQUEST_RECEIVED',
          title: 'New Borrowing Request',
          message: `${resolvedBorrowerName} has requested to borrow "${book.title}".`,
          relatedBookId: book._id,
          relatedRequestId: request._id,
        });
      } catch (err) {
        console.warn(`[circulationController] Notification error on borrow request: ${err.message}`);
      }
    }

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all borrow requests with optional filters
 * @route   GET /api/borrow-requests
 * @query   bookId, borrowerId, borrowerName, ownerId, ownerName, status
 */
const getBorrowRequests = async (req, res, next) => {
  try {
    const { bookId, borrowerId, borrowerName, ownerId, ownerName, status } = req.query;
    const filter = {};

    if (bookId) filter.bookId = bookId;
    if (borrowerId) filter.borrowerId = borrowerId;
    if (ownerId) filter.ownerId = ownerId;
    if (borrowerName) filter.borrowerName = new RegExp(`^${borrowerName.trim()}$`, 'i');
    if (ownerName) filter.ownerName = new RegExp(`^${ownerName.trim()}$`, 'i');
    if (status) filter.status = status;

    const requests = await BorrowRequest.find(filter)
      .populate('bookId', 'title author genre coverImage availability ownerName ownerId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single borrow request by ID
 * @route   GET /api/borrow-requests/:id
 */
const getBorrowRequest = async (req, res, next) => {
  try {
    const request = await BorrowRequest.findById(req.params.id)
      .populate('bookId', 'title author genre coverImage availability ownerName ownerId');

    if (!request) {
      return res.status(404).json({ success: false, error: 'Borrow request not found' });
    }

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve a borrowing request and set due date
 * @route   PATCH /api/borrow-requests/:id/approve
 * @body    { dueDate }
 */
const approveBorrowRequest = async (req, res, next) => {
  try {
    const { dueDate } = req.body;

    if (!dueDate) {
      return res.status(400).json({ success: false, error: 'Due date is required upon approval' });
    }

    const parsedDueDate = new Date(dueDate);
    const now = new Date();

    if (isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid due date format' });
    }

    // Due date validation: must be in the future
    if (parsedDueDate <= now) {
      return res.status(400).json({
        success: false,
        error: 'Due date must be in the future',
      });
    }

    const request = await BorrowRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Borrow request not found' });
    }

    // Authorization checks
    if (req.user) {
      // 1. Borrower cannot approve their own request
      if (request.borrowerId && request.borrowerId.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Borrowers cannot approve their own requests',
        });
      }

      // 2. Only the actual book owner can approve
      if (request.ownerId && !request.ownerId.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Only the book owner can approve this borrowing request',
        });
      }
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot approve request with current status: ${request.status}`,
      });
    }

    // Atomic race-condition protection: lock book only if availability is true
    const updatedBook = await Book.findOneAndUpdate(
      { _id: request.bookId, availability: true },
      { availability: false },
      { new: true }
    );

    if (!updatedBook) {
      return res.status(409).json({
        success: false,
        error: 'Book is no longer available. Another active loan has already been approved for this book.',
      });
    }

    // Update request
    request.status = 'Approved';
    request.approvedAt = now;
    request.dueDate = parsedDueDate;
    await request.save();

    // Create independent circulation record
    const circulationRecord = await CirculationRecord.create({
      borrowRequestId: request._id,
      bookId: updatedBook._id,
      bookTitle: updatedBook.title,
      bookAuthor: updatedBook.author,
      borrowerId: request.borrowerId,
      borrowerName: request.borrowerName,
      ownerId: request.ownerId || updatedBook.ownerId,
      ownerName: request.ownerName,
      borrowedDate: request.approvedAt,
      dueDate: request.dueDate,
      status: 'Active',
    });

    // Notify borrower that their request has been approved
    if (request.borrowerId) {
      try {
        const formattedDueDate = new Date(parsedDueDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        await createNotification({
          userId: request.borrowerId,
          type: 'BORROW_REQUEST_APPROVED',
          title: 'Borrow Request Approved',
          message: `Your request to borrow "${updatedBook.title}" was approved by ${request.ownerName}. Due date: ${formattedDueDate}.`,
          relatedBookId: updatedBook._id,
          relatedRequestId: request._id,
        });
      } catch (err) {
        console.warn(`[circulationController] Notification error on approve: ${err.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Borrow request approved successfully',
      data: {
        request,
        circulationRecord,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject a borrowing request
 * @route   PATCH /api/borrow-requests/:id/reject
 */
const rejectBorrowRequest = async (req, res, next) => {
  try {
    const request = await BorrowRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Borrow request not found' });
    }

    // Authorization checks
    if (req.user) {
      // 1. Borrower cannot reject their own request
      if (request.borrowerId && request.borrowerId.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Borrowers cannot reject their own requests',
        });
      }

      // 2. Only the actual book owner can reject
      if (request.ownerId && !request.ownerId.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Only the book owner can reject this borrowing request',
        });
      }
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        error: `Cannot reject request with current status: ${request.status}`,
      });
    }

    request.status = 'Rejected';
    await request.save();

    // Notify borrower that their request was rejected
    if (request.borrowerId) {
      try {
        const parentBook = await Book.findById(request.bookId);
        const bookTitle = parentBook ? parentBook.title : 'the volume';
        await createNotification({
          userId: request.borrowerId,
          type: 'BORROW_REQUEST_REJECTED',
          title: 'Borrow Request Declined',
          message: `Your request to borrow "${bookTitle}" was declined by ${request.ownerName}.`,
          relatedBookId: request.bookId,
          relatedRequestId: request._id,
        });
      } catch (err) {
        console.warn(`[circulationController] Notification error on reject: ${err.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Borrow request rejected',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark an approved loan as returned
 * @route   PATCH /api/borrow-requests/:id/return
 */
const returnBorrowRequest = async (req, res, next) => {
  try {
    const request = await BorrowRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Borrow request not found' });
    }

    // Authorization: Only the book owner can mark as returned
    if (req.user && request.ownerId && !request.ownerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only the book owner can mark this loan as returned',
      });
    }

    if (request.status === 'Returned') {
      return res.status(400).json({
        success: false,
        error: 'This loan has already been marked as returned',
      });
    }

    if (request.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot return a request with status: ${request.status}`,
      });
    }

    const now = new Date();

    // 1. Update request status
    request.status = 'Returned';
    request.returnedAt = now;
    await request.save();

    // 2. Restore book availability
    await Book.findByIdAndUpdate(request.bookId, { availability: true });

    // 3. Update circulation record
    await CirculationRecord.findOneAndUpdate(
      { borrowRequestId: request._id },
      {
        returnedDate: now,
        status: 'Returned',
      }
    );

    // Notify borrower and owner about the completed return
    try {
      const parentBook = await Book.findById(request.bookId);
      const bookTitle = parentBook ? parentBook.title : 'the volume';

      if (request.borrowerId) {
        await createNotification({
          userId: request.borrowerId,
          type: 'BOOK_RETURNED',
          title: 'Book Return Recorded',
          message: `Your return of "${bookTitle}" has been safely confirmed. Thank you for circulating stories!`,
          relatedBookId: request.bookId,
          relatedRequestId: request._id,
        });
      }

      if (request.ownerId) {
        await createNotification({
          userId: request.ownerId,
          type: 'BOOK_RETURNED',
          title: 'Book Returned to Shelf',
          message: `"${bookTitle}" has been returned by ${request.borrowerName} and is now back in your collection.`,
          relatedBookId: request.bookId,
          relatedRequestId: request._id,
        });
      }
    } catch (err) {
      console.warn(`[circulationController] Notification error on return: ${err.message}`);
    }

    res.status(200).json({
      success: true,
      message: 'Book marked as returned successfully. Availability restored.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get community circulation history with dynamic overdue status
 * @route   GET /api/circulation
 * @query   status, borrowerId, borrowerName, ownerId, ownerName
 */
const getCirculationRecords = async (req, res, next) => {
  try {
    const { status, borrowerId, borrowerName, ownerId, ownerName } = req.query;
    const now = new Date();

    // If query requests pending requests, fetch directly from BorrowRequest
    if (status === 'pending') {
      const query = { status: 'Pending' };
      if (borrowerId) query.borrowerId = borrowerId;
      if (ownerId) query.ownerId = ownerId;
      if (borrowerName) query.borrowerName = new RegExp(`^${borrowerName.trim()}$`, 'i');
      if (ownerName) query.ownerName = new RegExp(`^${ownerName.trim()}$`, 'i');

      const pending = await BorrowRequest.find(query)
        .populate('bookId', 'title author')
        .sort({ createdAt: -1 });

      const records = pending.map((r) => ({
        _id: r._id,
        borrowRequestId: r._id,
        bookId: r.bookId ? r.bookId._id : r.bookId,
        bookTitle: r.bookId ? r.bookId.title : 'Unknown Title',
        bookAuthor: r.bookId ? r.bookId.author : '',
        borrowerId: r.borrowerId,
        borrowerName: r.borrowerName,
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        borrowedDate: null,
        dueDate: null,
        returnedDate: null,
        status: 'Pending',
        isOverdue: false,
        overdueDays: 0,
        createdAt: r.createdAt,
      }));

      return res.status(200).json({
        success: true,
        count: records.length,
        data: records,
      });
    }

    const query = {};
    if (borrowerId) query.borrowerId = borrowerId;
    if (ownerId) query.ownerId = ownerId;
    if (borrowerName) query.borrowerName = new RegExp(`^${borrowerName.trim()}$`, 'i');
    if (ownerName) query.ownerName = new RegExp(`^${ownerName.trim()}$`, 'i');

    if (status === 'active') {
      query.status = 'Active';
      query.dueDate = { $gte: now };
    } else if (status === 'overdue') {
      query.status = 'Active';
      query.dueDate = { $lt: now };
    } else if (status === 'returned') {
      query.status = 'Returned';
    }

    const records = await CirculationRecord.find(query).sort({ createdAt: -1 });

    // Calculate overdue dynamically
    const enrichedRecords = records.map((record) => {
      const obj = record.toObject();
      const isOverdue = obj.status === 'Active' && new Date(obj.dueDate) < now;
      let overdueDays = 0;
      if (isOverdue) {
        const diffMs = now.getTime() - new Date(obj.dueDate).getTime();
        overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }
      return {
        ...obj,
        isOverdue,
        overdueDays,
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedRecords.length,
      data: enrichedRecords,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently overdue loans
 * @route   GET /api/circulation/overdue
 */
const getOverdueLoans = async (req, res, next) => {
  try {
    const now = new Date();

    const overdueRecords = await CirculationRecord.find({
      status: 'Active',
      dueDate: { $lt: now },
    }).sort({ dueDate: 1 });

    const enriched = overdueRecords.map((record) => {
      const obj = record.toObject();
      const diffMs = now.getTime() - new Date(obj.dueDate).getTime();
      const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        ...obj,
        isOverdue: true,
        overdueDays,
      };
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit a one-time handover proposal for an approved borrowing request (Owner only)
 * @route   POST /api/borrow-requests/:id/handover/propose
 */
const proposeHandover = async (req, res, next) => {
  try {
    const { date, time, instructions } = req.body;

    if (!date || !date.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Handover date is required',
      });
    }

    if (!time || !time.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Handover time is required',
      });
    }

    if (!instructions || !instructions.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Handover location or instructions are required',
      });
    }

    const trimmedInstructions = instructions.trim();
    if (trimmedInstructions.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Handover instructions cannot exceed 500 characters',
      });
    }

    const proposedDateObj = new Date(date);
    if (isNaN(proposedDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid handover date provided',
      });
    }

    // Ensure date is not in the past (compare with midnight of today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const proposedDay = new Date(proposedDateObj);
    proposedDay.setHours(0, 0, 0, 0);

    if (proposedDay < today) {
      return res.status(400).json({
        success: false,
        error: 'Handover date cannot be in the past',
      });
    }

    const request = await BorrowRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Borrow request not found',
      });
    }

    // Authorization: only the verified book owner can propose
    if (req.user && request.ownerId && !request.ownerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only the book owner can create a handover proposal',
      });
    }

    // Request must be in Approved status
    if (request.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot propose handover for request with status: ${request.status}`,
      });
    }

    // Verify proposed date is on or before return dueDate
    if (request.dueDate) {
      const dueDay = new Date(request.dueDate);
      dueDay.setHours(23, 59, 59, 999);
      if (proposedDateObj > dueDay) {
        return res.status(400).json({
          success: false,
          error: 'Handover date cannot be scheduled after the agreed return due date',
        });
      }
    }

    // Update handover subdocument
    const wasDeclined = request.handover?.status === 'Declined';
    request.handover = {
      status: 'Proposed',
      proposedDate: proposedDateObj,
      proposedTime: time.trim(),
      instructions: trimmedInstructions,
      proposedAt: new Date(),
      respondedAt: null,
      rescheduleCount: wasDeclined ? (request.handover?.rescheduleCount || 0) + 1 : (request.handover?.rescheduleCount || 0),
    };

    await request.save();

    // Populate book details if possible for notification message
    let bookTitle = 'your requested book';
    const parentBook = await Book.findById(request.bookId);
    if (parentBook) bookTitle = parentBook.title;

    // Notify borrower
    if (request.borrowerId) {
      try {
        const formattedDate = proposedDateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const summary = trimmedInstructions.length > 80 ? `${trimmedInstructions.slice(0, 80)}...` : trimmedInstructions;

        await createNotification({
          userId: request.borrowerId,
          type: 'HANDOVER_PROPOSED',
          title: 'Handover Proposed',
          message: `${request.ownerName} proposed handing over "${bookTitle}" on ${formattedDate} at ${time.trim()}. Location: "${summary}". Please review and confirm.`,
          relatedBookId: request.bookId,
          relatedRequestId: request._id,
        });
      } catch (notifErr) {
        console.warn(`[circulationController] Notification error on proposeHandover: ${notifErr.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Handover proposal sent to borrower',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept (YES) or decline (NO) a handover proposal (Borrower only)
 * @route   PATCH /api/borrow-requests/:id/handover/respond
 */
const respondHandover = async (req, res, next) => {
  try {
    const { decision } = req.body;

    if (!decision || typeof decision !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Response decision is required ("YES" or "NO")',
      });
    }

    const normalizedDecision = decision.trim().toUpperCase();
    if (normalizedDecision !== 'YES' && normalizedDecision !== 'NO') {
      return res.status(400).json({
        success: false,
        error: 'Decision must be either "YES" (Accept) or "NO" (Decline)',
      });
    }

    const request = await BorrowRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Borrow request not found',
      });
    }

    // Authorization: only the borrower can accept or decline
    if (req.user && request.borrowerId && !request.borrowerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only the borrowing reader can respond to this handover proposal',
      });
    }

    // Must be in Approved status
    if (request.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        error: `Cannot respond to handover for request with status: ${request.status}`,
      });
    }

    // Handover status must be Proposed
    if (!request.handover || request.handover.status !== 'Proposed') {
      return res.status(400).json({
        success: false,
        error: 'There is no pending handover proposal awaiting your response',
      });
    }

    let bookTitle = 'the volume';
    const parentBook = await Book.findById(request.bookId);
    if (parentBook) bookTitle = parentBook.title;

    const formattedDate = request.handover.proposedDate
      ? new Date(request.handover.proposedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'the scheduled date';

    if (normalizedDecision === 'YES') {
      request.handover.status = 'Accepted';
      request.handover.respondedAt = new Date();
      await request.save();

      // Notify book owner
      if (request.ownerId) {
        try {
          await createNotification({
            userId: request.ownerId,
            type: 'HANDOVER_ACCEPTED',
            title: 'Handover Proposal Accepted',
            message: `${request.borrowerName} accepted the handover proposal for "${bookTitle}" on ${formattedDate} at ${request.handover.proposedTime}. Details are confirmed.`,
            relatedBookId: request.bookId,
            relatedRequestId: request._id,
          });
        } catch (notifErr) {
          console.warn(`[circulationController] Notification error on handover acceptance: ${notifErr.message}`);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Handover proposal accepted. The scheduled handover details are now confirmed.',
        data: request,
      });
    } else {
      // Decision is NO (Decline)
      // Keep request status strictly as 'Approved'
      request.handover.status = 'Declined';
      request.handover.respondedAt = new Date();
      await request.save();

      // Notify book owner to reschedule
      if (request.ownerId) {
        try {
          await createNotification({
            userId: request.ownerId,
            type: 'HANDOVER_DECLINED',
            title: 'Handover Proposal Declined',
            message: `${request.borrowerName} declined the proposed handover for "${bookTitle}". Please propose alternative details on your Lending Desk.`,
            relatedBookId: request.bookId,
            relatedRequestId: request._id,
          });
        } catch (notifErr) {
          console.warn(`[circulationController] Notification error on handover decline: ${notifErr.message}`);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Handover proposal declined. The owner has been notified and can propose alternative details.',
        data: request,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
