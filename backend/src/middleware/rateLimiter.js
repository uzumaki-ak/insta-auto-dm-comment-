/**
 * Rate Limiter Middleware
 * Prevents abuse of API endpoints
 * Uses in-memory store (simple) - for production use Redis
 */

const logger = require('../utils/logger');

// Store for tracking request counts
// Format: { 'ip-endpoint': { count: 5, resetTime: timestamp } }
const requestStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestStore.entries()) {
    if (value.resetTime < now) {
      requestStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 * 
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Max requests per window
 * @param {string} options.message - Error message
 * @returns {Function} - Express middleware
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    message = 'Too many requests, please try again later'
  } = options;
  
  return (req, res, next) => {
    // Create unique key for this IP + endpoint
    const key = `${req.ip}-${req.path}`;
    
    const now = Date.now();
    const resetTime = now + windowMs;
    
    // Get or create record for this key
    let record = requestStore.get(key);
    
    if (!record) {
      // First request from this IP+endpoint
      record = { count: 1, resetTime };
      requestStore.set(key, record);
      return next();
    }
    
    // Check if window has expired
    if (record.resetTime < now) {
      // Reset the counter
      record.count = 1;
      record.resetTime = resetTime;
      requestStore.set(key, record);
      return next();
    }
    
    // Increment counter
    record.count++;
    
    // Check if limit exceeded
    if (record.count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        count: record.count,
        maxRequests
      });
      
      // Calculate retry-after time
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      
      res.set('Retry-After', retryAfter);
      res.set('X-RateLimit-Limit', maxRequests);
      res.set('X-RateLimit-Remaining', 0);
      res.set('X-RateLimit-Reset', record.resetTime);
      
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter
      });
    }
    
    // Add rate limit headers
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', maxRequests - record.count);
    res.set('X-RateLimit-Reset', record.resetTime);
    
    next();
  };
};

/**
 * Strict rate limiter for sensitive endpoints
 * 5 requests per minute
 */
const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many requests to this endpoint'
});

/**
 * Standard rate limiter for API endpoints
 * 100 requests per 15 minutes
 */
const standardRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests, please slow down'
});

/**
 * Lenient rate limiter for public endpoints
 * 300 requests per 15 minutes
 */
const lenientRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 300,
  message: 'Rate limit exceeded'
});

module.exports = {
  createRateLimiter,
  strictRateLimiter,
  standardRateLimiter,
  lenientRateLimiter
};