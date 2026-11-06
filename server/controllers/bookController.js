const Book = require('../models/Book');
const { searchVolumes } = require('../services/googleBooksService');
const openLibraryService = require('../services/openLibraryService');
const { getNearbyNeighborhoods } = require('../constants/neighborhoods');

/**
 * Escape regular expression metacharacters to prevent ReDoS & syntax errors
 */
const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

/**
 * @desc    Get all books with optional search, genre filter and Bengaluru neighbourhood proximity discovery
 * @route   GET /api/books
 * @query   search, genre, availability, neighborhood, userNeighborhood
 */
const getBooks = async (req, res, next) => {
  try {
    const { search, genre, availability, neighborhood, userNeighborhood } = req.query;
    const filter = {};

    // Text search on title and author (safely escaped)
    if (search && search.trim()) {
      const escaped = escapeRegex(search.trim());
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [{ title: searchRegex }, { author: searchRegex }];
    }

    // Genre filter
    if (genre && genre.trim()) {
      filter.genre = genre.trim();
    }

    // Availability filter
    if (availability !== undefined) {
      filter.availability = availability === 'true';
    }

    // Owner ID filter
    if (req.query.ownerId) {
      filter.ownerId = req.query.ownerId;
    }

    // Determine target neighbourhood for Bengaluru proximity discovery priority:
    // 1. Explicitly selected neighbourhood in Explore Books
    // 2. Or explicit userNeighborhood query parameter
    // 3. Or logged-in reader's profile neighbourhood
    const activeTargetNeighborhood = (neighborhood && neighborhood.trim())
      || (userNeighborhood && userNeighborhood.trim())
      || (req.user && req.user.neighborhood ? req.user.neighborhood : null);

    let books;

    // Proximity prioritisation:
    // Rank 1: Books in target neighbourhood appear first
    // Rank 2: Books in nearby/adjacent Bengaluru neighbourhoods appear second
    // Rank 3: Books in other Bengaluru neighbourhoods appear third
    // Rank 4: Books without specified neighbourhood appear fourth
    // All books across Bengaluru remain discoverable (no books are hidden)
    if (activeTargetNeighborhood) {
      const nearbyList = getNearbyNeighborhoods(activeTargetNeighborhood);

      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            locationPriority: {
              $switch: {
                branches: [
                  { case: { $eq: ['$ownerNeighborhood', activeTargetNeighborhood] }, then: 3 },
                  { case: { $in: ['$ownerNeighborhood', nearbyList] }, then: 2 },
                  {
                    case: {
                      $and: [
                        { $ne: ['$ownerNeighborhood', ''] },
                        { $ne: ['$ownerNeighborhood', null] },
                      ],
                    },
                    then: 1,
                  },
                ],
                default: 0,
              },
            },
          },
        },
        {
          $sort: { locationPriority: -1, createdAt: -1 },
        },
      ];

      books = await Book.aggregate(pipeline);
    } else {
      // Standard chronological sorting across all Bengaluru
      books = await Book.find(filter).sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      count: books.length,
      data: books,
      activeTargetNeighborhood: activeTargetNeighborhood || null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single book by ID
 * @route   GET /api/books/:id
 */
const getBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      const error = new Error('Book not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new book
 * @route   POST /api/books
 */
const createBook = async (req, res, next) => {
  try {
    const { title, author, genre, description, coverImage, ownerName, availability } = req.body;

    // Derive owner identity from authenticated user when available
    const ownerId = req.user ? req.user._id : undefined;
    const resolvedOwnerName = req.user ? req.user.name : (ownerName ? ownerName.trim() : '');
    const resolvedOwnerNeighborhood = req.user && req.user.neighborhood
      ? req.user.neighborhood
      : (req.body.ownerNeighborhood ? req.body.ownerNeighborhood.trim() : '');

    const book = await Book.create({
      title: title.trim(),
      author: author.trim(),
      genre: genre.trim(),
      description: description ? description.trim() : '',
      coverImage: coverImage ? coverImage.trim() : '',
      ownerId,
      ownerName: resolvedOwnerName,
      ownerNeighborhood: resolvedOwnerNeighborhood,
      availability: availability !== undefined ? availability : true,
    });

    res.status(201).json({
      success: true,
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a book
 * @route   PATCH /api/books/:id
 */
const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      const error = new Error('Book not found');
      error.statusCode = 404;
      throw error;
    }

    // Authorization: Only the actual owner can update their book
    if (req.user && book.ownerId && !book.ownerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to update this book',
      });
    }

    // Only update fields that are provided; do not allow client to change ownerId arbitrarily
    const allowedFields = ['title', 'author', 'genre', 'description', 'coverImage', 'availability'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    }

    const updatedBook = await Book.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: updatedBook,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a book
 * @route   DELETE /api/books/:id
 */
const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      const error = new Error('Book not found');
      error.statusCode = 404;
      throw error;
    }

    // Authorization: Only the actual owner can delete their book
    if (req.user && book.ownerId && !book.ownerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to remove this book',
      });
    }

    // Data integrity: Cannot delete a book that is actively on loan
    if (!book.availability) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a book that is currently on loan. Please wait until it is returned.',
      });
    }

    await Book.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Book removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get community statistics
 * @route   GET /api/stats
 */
const getStats = async (req, res, next) => {
  try {
    const totalBooks = await Book.countDocuments();
    const availableBooks = await Book.countDocuments({ availability: true });
    const sharedBooks = await Book.countDocuments({ availability: false });

    res.status(200).json({
      success: true,
      data: {
        totalBooks,
        availableBooks,
        sharedBooks,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Lookup book metadata via Open Library API (authenticated proxy)
 * @route   GET /api/books/lookup?q=...
 */
const lookupBookMetadata = async (req, res, next) => {
  try {
    const { q, maxResults } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required for book lookup',
      });
    }

    const limit = maxResults ? parseInt(maxResults, 10) : 8;
    const results = await openLibraryService.searchVolumes(q.trim(), limit);

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
      source: 'open-library',
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

/**
 * @desc    Lookup book metadata via Google Books API (authenticated proxy)
 * @route   GET /api/books/google-lookup?q=...
 */
const lookupGoogleBooks = async (req, res, next) => {
  try {
    const { q, maxResults } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required for book lookup',
      });
    }

    const limit = maxResults ? parseInt(maxResults, 10) : 8;
    const results = await searchVolumes(q.trim(), limit);

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getStats,
  lookupGoogleBooks,
  lookupBookMetadata,
};

