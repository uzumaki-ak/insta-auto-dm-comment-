/**
 * Global Error Handler
 * Catches all errors thrown in the application
 * Provides consistent error responses and logging
 */

const logger = require('../utils/logger');

/**
 * Express error handling middleware
 * MUST have 4 parameters for Express to recognize it as error handler
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the full error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Determine status code
  let statusCode = err.statusCode || 500;
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
  }
  
  // Generic error message for production
  let errorMessage = err.message || 'Internal server error';
  
  // In production, don't leak sensitive error details
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    errorMessage = 'An unexpected error occurred';
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details
    })
  });
};

/**
 * 404 Not Found handler
 * For routes that don't exist
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const notFoundHandler = (req, res) => {
  logger.warn('404 - Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 * Without this, you need try-catch in every async function
 * 
 * Usage:
 * router.get('/posts', asyncHandler(async (req, res) => {
 *   const posts = await getPosts();
 *   res.json(posts);
 * }));
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};