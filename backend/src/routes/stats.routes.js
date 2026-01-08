/**
 * Stats Routes
 * Analytics and statistics endpoints
 * All routes require authentication
 */

const express = require('express');
const router = express.Router();
const {
  getOverallStats,
  getPostStats,
  getRecentReplies
} = require('../controllers/stats.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { standardRateLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');

// Apply authentication
router.use(authenticate);

// Apply rate limiting
router.use(standardRateLimiter);

// ============================================
// STATS ROUTES
// ============================================

/**
 * GET /api/stats
 * Get overall statistics
 * Returns database stats and queue stats
 */
router.get('/', asyncHandler(getOverallStats));

/**
 * GET /api/stats/posts/:postId
 * Get statistics for a specific post
 */
router.get('/posts/:postId', asyncHandler(getPostStats));

/**
 * GET /api/stats/posts/:postId/replies
 * Get recent replied users for a post
 * 
 * Query params:
 * - limit: number (default 50)
 */
router.get('/posts/:postId/replies', asyncHandler(getRecentReplies));

module.exports = router;