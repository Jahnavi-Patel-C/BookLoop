const express = require('express');
const router = express.Router();
const {
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getStats,
  lookupGoogleBooks,
  lookupBookMetadata,
} = require('../controllers/bookController');
const validateBook = require('../middleware/validateBook');
const { requireAuth } = require('../middleware/auth');

// Stats route (must come before /:id to avoid conflict)
router.get('/stats', getStats);

// Book metadata lookup proxy (Open Library, no API keys required)
router.get('/lookup', requireAuth, lookupBookMetadata);

// Google Books lookup proxy (retained for backward compatibility)
router.get('/google-lookup', requireAuth, lookupGoogleBooks);

// Book CRUD routes
router.route('/')
  .get(getBooks)
  .post(requireAuth, validateBook, createBook);

router.route('/:id')
  .get(getBook)
  .patch(requireAuth, validateBook, updateBook)
  .delete(requireAuth, deleteBook);

module.exports = router;
