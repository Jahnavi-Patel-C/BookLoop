/**
 * Centralized error-handling middleware.
 * Catches all errors passed via next(error) and sends a consistent JSON response.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`Error: ${err.message}`);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      messages,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid resource ID format',
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate field value',
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const errorMessage = statusCode === 500 && isProd
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  res.status(statusCode).json({
    success: false,
    error: errorMessage,
  });
};

module.exports = errorHandler;

