/**
 * Posts Routes
 * CRUD operations for Instagram posts
 * All routes require authentication
 */

const express = require('express');
const router = express.Router();
const {
  getAllPosts,
  getPostById,
  syncPostsFromInstagram,
  addKeyword,
  deleteKeyword,
  togglePostActive
} = require('../controllers/posts.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { standardRateLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');

// Apply authentication to all routes
router.use(authenticate);

// Apply rate limiting
router.use(standardRateLimiter);

// ============================================
// POST ROUTES
// ============================================

/**
 * GET /api/posts
 * Get all posts with stats
 */
router.get('/', asyncHandler(getAllPosts));

/**
 * GET /api/posts/:postId
 * Get single post with keywords and stats
 */
router.get('/:postId', asyncHandler(getPostById));

/**
 * POST /api/posts/sync
 * Sync posts from Instagram API
 */
router.post('/sync', asyncHandler(syncPostsFromInstagram));

/**
 * PUT /api/posts/:postId/toggle
 * Enable/disable automation for a post
 * 
 * Body: { is_active: boolean }
 */
router.put('/:postId/toggle', asyncHandler(togglePostActive));

// ============================================
// KEYWORD ROUTES
// ============================================

/**
 * POST /api/posts/:postId/keywords
 * Add or update keyword for a post
 * 
 * Body: {
 *   keyword: string,
 *   case_sensitive: boolean,
 *   comment_reply: string,
 *   dm_message: string (optional)
 * }
 */
router.post('/:postId/keywords', asyncHandler(addKeyword));

/**
 * DELETE /api/posts/keywords/:keywordId
 * Delete a keyword
 */
router.delete('/keywords/:keywordId', asyncHandler(deleteKeyword));

module.exports = router;