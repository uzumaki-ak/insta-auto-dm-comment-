/**
 * Posts Controller
 * Handles CRUD operations for Instagram posts
 * Used by the frontend dashboard
 */

const { query, getClient } = require('../config/database');
const instagramService = require('../services/instagram.service');
const deduplicationService = require('../services/deduplication.service');
const logger = require('../utils/logger');

// ============================================
// GET ALL POSTS
// ============================================

/**
 * Get all posts from database with their keywords
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getAllPosts = async (req, res) => {
  try {
    const result = await query(
      `SELECT 
         p.*,
         COUNT(DISTINCT k.id) as keyword_count,
         COUNT(DISTINCT rc.user_id) as replies_count
       FROM posts p
       LEFT JOIN keywords k ON p.id = k.post_id
       LEFT JOIN replied_comments rc ON p.id = rc.post_id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );
    
    logger.info('Fetched all posts', { count: result.rows.length });
    
    res.json({
      success: true,
      posts: result.rows
    });
    
  } catch (error) {
    logger.error('Failed to get posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts'
    });
  }
};

// ============================================
// GET SINGLE POST WITH DETAILS
// ============================================

/**
 * Get a single post with all keywords and stats
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Get post details
    const postResult = await query(
      `SELECT * FROM posts WHERE id = $1`,
      [postId]
    );
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    const post = postResult.rows[0];
    
    // Get keywords for this post
    const keywordsResult = await query(
      `SELECT * FROM keywords WHERE post_id = $1 ORDER BY created_at DESC`,
      [postId]
    );
    
    // Get reply stats
    const stats = await deduplicationService.getPostReplyStats(postId);
    
    res.json({
      success: true,
      post: {
        ...post,
        keywords: keywordsResult.rows,
        stats
      }
    });
    
  } catch (error) {
    logger.error('Failed to get post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post'
    });
  }
};

// ============================================
// SYNC POSTS FROM INSTAGRAM
// ============================================

/**
 * Fetch recent posts from Instagram and add to database
 * This is called from frontend when user wants to add new posts
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const syncPostsFromInstagram = async (req, res) => {
  try {
    logger.info('Syncing posts from Instagram...');
    
    // Fetch recent media from Instagram API
    const recentMedia = await instagramService.getRecentMedia(25);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    // Add each media to database (if not already exists)
    for (const media of recentMedia) {
      try {
        await query(
          `INSERT INTO posts (media_id, media_type, caption, media_url, permalink)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (media_id) DO NOTHING`,
          [
            media.id,
            media.media_type,
            media.caption || '',
            media.media_url,
            media.permalink
          ]
        );
        
        addedCount++;
        
      } catch (err) {
        // If ON CONFLICT DO NOTHING, rowCount will be 0
        skippedCount++;
        logger.debug('Post already exists', { mediaId: media.id });
      }
    }
    
    logger.info('✅ Posts synced from Instagram', {
      total: recentMedia.length,
      added: addedCount,
      skipped: skippedCount
    });
    
    res.json({
      success: true,
      synced: recentMedia.length,
      added: addedCount,
      skipped: skippedCount
    });
    
  } catch (error) {
    logger.error('Failed to sync posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync posts from Instagram'
    });
  }
};

// ============================================
// ADD/UPDATE KEYWORDS
// ============================================

/**
 * Add or update keyword for a post
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const addKeyword = async (req, res) => {
  try {
    const { postId } = req.params;
    const {
      keyword,
      case_sensitive = false,
      comment_reply,
      dm_message
    } = req.body;
    
    // Validate input
    if (!keyword || !comment_reply) {
      return res.status(400).json({
        success: false,
        error: 'Keyword and comment_reply are required'
      });
    }
    
    // Verify post exists
    const postCheck = await query(
      `SELECT id FROM posts WHERE id = $1`,
      [postId]
    );
    
    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    // Insert or update keyword
    const result = await query(
      `INSERT INTO keywords (post_id, keyword, case_sensitive, comment_reply, dm_message)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (post_id, keyword)
       DO UPDATE SET
         case_sensitive = EXCLUDED.case_sensitive,
         comment_reply = EXCLUDED.comment_reply,
         dm_message = EXCLUDED.dm_message
       RETURNING *`,
      [postId, keyword, case_sensitive, comment_reply, dm_message]
    );
    
    logger.info('✅ Keyword added/updated', {
      postId,
      keyword
    });
    
    res.json({
      success: true,
      keyword: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Failed to add keyword:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add keyword'
    });
  }
};

/**
 * Delete a keyword
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const deleteKeyword = async (req, res) => {
  try {
    const { keywordId } = req.params;
    
    await query(
      `DELETE FROM keywords WHERE id = $1`,
      [keywordId]
    );
    
    logger.info('✅ Keyword deleted', { keywordId });
    
    res.json({
      success: true,
      message: 'Keyword deleted'
    });
    
  } catch (error) {
    logger.error('Failed to delete keyword:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete keyword'
    });
  }
};

// ============================================
// TOGGLE POST ACTIVE STATUS
// ============================================

/**
 * Enable/disable automation for a post
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const togglePostActive = async (req, res) => {
  try {
    const { postId } = req.params;
    const { is_active } = req.body;
    
    const result = await query(
      `UPDATE posts SET is_active = $1 WHERE id = $2 RETURNING *`,
      [is_active, postId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    logger.info('✅ Post status toggled', {
      postId,
      is_active
    });
    
    res.json({
      success: true,
      post: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Failed to toggle post:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update post'
    });
  }
};

module.exports = {
  getAllPosts,
  getPostById,
  syncPostsFromInstagram,
  addKeyword,
  deleteKeyword,
  togglePostActive
};