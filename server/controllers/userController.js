const User = require('../models/User');
const Book = require('../models/Book');
const BorrowRequest = require('../models/BorrowRequest');
const CirculationRecord = require('../models/CirculationRecord');

/**
 * @desc    Get authenticated user's profile and circulation summary
 * @route   GET /api/users/profile
 */
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }

    const userId = req.user._id;

    // Parallel aggregate queries for profile statistics
    const [
      booksListedCount,
      booksBorrowedCount,
      activeLoansCount,
      completedReturnsCount,
      recentBooks,
      recentBorrowings,
      recentLendings,
    ] = await Promise.all([
      Book.countDocuments({ ownerId: userId }),
      BorrowRequest.countDocuments({ borrowerId: userId, status: { $in: ['Approved', 'Returned'] } }),
      BorrowRequest.countDocuments({ ownerId: userId, status: 'Approved' }),
      BorrowRequest.countDocuments({
        $or: [{ ownerId: userId }, { borrowerId: userId }],
        status: 'Returned',
      }),
      Book.find({ ownerId: userId }).sort({ createdAt: -1 }).limit(5),
      BorrowRequest.find({ borrowerId: userId })
        .populate('bookId', 'title author genre coverImage')
        .sort({ createdAt: -1 })
        .limit(5),
      BorrowRequest.find({ ownerId: userId })
        .populate('bookId', 'title author genre coverImage')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          booksListed: booksListedCount,
          booksBorrowed: booksBorrowedCount,
          activeLoans: activeLoansCount,
          completedReturns: completedReturnsCount,
        },
        recentBooks,
        recentBorrowings,
        recentLendings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update authenticated user's profile (name & neighbourhood)
 * @route   PATCH /api/users/profile
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const { name, neighborhood } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Display name is required',
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Display name must be between 2 and 50 characters',
      });
    }

    const userUpdates = { name: trimmedName };
    const bookUpdates = { ownerName: trimmedName };

    if (neighborhood !== undefined) {
      const trimmedNeighborhood = typeof neighborhood === 'string' ? neighborhood.trim() : '';
      userUpdates.neighborhood = trimmedNeighborhood;
      bookUpdates.ownerNeighborhood = trimmedNeighborhood;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      userUpdates,
      { new: true, runValidators: true }
    ).select('-password');

    // Also synchronize ownerName & ownerNeighborhood on books listed by this user
    await Book.updateMany({ ownerId: req.user._id }, bookUpdates);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get personalized live dashboard statistics for authenticated user
 * @route   GET /api/users/dashboard-stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const [
      booksListed,
      activeLoans,
      pendingBorrowRequests,
      activeBorrowings,
      overdueLoans,
      completedCirculations,
    ] = await Promise.all([
      // Total books catalogued by user
      Book.countDocuments({ ownerId: userId }),
      // Books currently loaned out by user (Approved status where user is owner)
      BorrowRequest.countDocuments({ ownerId: userId, status: 'Approved' }),
      // Pending requests awaiting user's action
      BorrowRequest.countDocuments({ ownerId: userId, status: 'Pending' }),
      // Books user has currently borrowed (Approved status where user is borrower)
      BorrowRequest.countDocuments({ borrowerId: userId, status: 'Approved' }),
      // Overdue loans (either as owner or borrower)
      BorrowRequest.countDocuments({
        $or: [{ ownerId: userId }, { borrowerId: userId }],
        status: 'Approved',
        dueDate: { $lt: now },
      }),
      // Completed circulations (Returned status)
      BorrowRequest.countDocuments({
        $or: [{ ownerId: userId }, { borrowerId: userId }],
        status: 'Returned',
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        booksListed,
        activeLoans,
        pendingBorrowRequests,
        activeBorrowings,
        overdueLoans,
        completedCirculations,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getDashboardStats,
};

