/**
 * Validate book input for POST and PATCH requests.
 */
const validateBook = (req, res, next) => {
  const { title, author, genre, ownerName } = req.body;
  const effectiveOwnerName = req.user ? req.user.name : ownerName;
  const errors = [];

  // For POST requests, all required fields must be present
  if (req.method === 'POST') {
    if (!title || !title.trim()) {
      errors.push('Book title is required');
    }
    if (!author || !author.trim()) {
      errors.push('Author name is required');
    }
    if (!genre || !genre.trim()) {
      errors.push('Genre is required');
    }
    if (!effectiveOwnerName || !effectiveOwnerName.trim()) {
      errors.push('Owner display name is required');
    }
  }

  // Length validations (apply to both POST and PATCH)
  if (title && title.length > 200) {
    errors.push('Title cannot exceed 200 characters');
  }
  if (author && author.length > 100) {
    errors.push('Author name cannot exceed 100 characters');
  }
  if (ownerName && ownerName.length > 50) {
    errors.push('Owner name cannot exceed 50 characters');
  }
  if (req.body.description && req.body.description.length > 2000) {
    errors.push('Description cannot exceed 2000 characters');
  }

  // Cover image URL basic validation
  if (req.body.coverImage && req.body.coverImage.trim()) {
    try {
      new URL(req.body.coverImage);
    } catch {
      errors.push('Cover image must be a valid URL');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      messages: errors,
    });
  }

  next();
};

module.exports = validateBook;

