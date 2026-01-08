/**
 * Deduplication Service
 * CRITICAL: Prevents replying to the same user multiple times on the same post
 * This is the core logic that prevents spam and maintains user experience
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// DEDUPLICATION CHECK (MOST IMPORTANT FUNCTION)
// ============================================

/**
 * Check if we've already replied to this user on this post
 * This runs BEFORE every reply to prevent duplicates
 * 
 * @param {string} postId - Our internal post UUID
 * @param {string} userId - Instagram user ID
 * @returns {Promise<boolean>} - True if already replied, false if safe to reply
 */
const hasAlreadyReplied = async (postId, userId) => {
  try {
    const result = await db.query(
      `SELECT id, replied_at, status 
       FROM replied_comments 
       WHERE post_id = $1 AND user_id = $2
       LIMIT 1`,
      [postId, userId]
    );
    
    const alreadyReplied = result.rows.length > 0;
    
    if (alreadyReplied) {
      logger.debug('User already replied to on this post', {
        postId,
        userId,
        previousReply: result.rows[0]
      });
    }
    
    return alreadyReplied;
    
  } catch (error) {
    logger.error('Error checking deduplication:', {
      postId,
      userId,
      error: error.message
    });
    
    // CRITICAL SAFETY: If database check fails, assume already replied
    // This prevents spam in case of database issues
    logger.warn('Deduplication check failed - assuming already replied to be safe');
    return true;
  }
};

/**
 * Check if we've replied to a specific comment ID
 * Useful for idempotency (if webhook fires twice for same comment)
 * 
 * @param {string} commentId - Instagram comment ID
 * @returns {Promise<boolean>}
 */
const hasProcessedComment = async (commentId) => {
  try {
    const result = await db.query(
      `SELECT id FROM replied_comments WHERE comment_id = $1 LIMIT 1`,
      [commentId]
    );
    
    return result.rows.length > 0;
    
  } catch (error) {
    logger.error('Error checking comment processing:', {
      commentId,
      error: error.message
    });
    return true; // Assume processed to be safe
  }
};

// ============================================
// RECORDING REPLIES
// ============================================

/**
 * Record that we replied to a user
 * This is called AFTER successful reply/DM
 * 
 * @param {Object} data - Reply data
 * @param {string} data.postId - Our internal post UUID
 * @param {string} data.commentId - Instagram comment ID
 * @param {string} data.userId - Instagram user ID
 * @param {string} data.username - Instagram username
 * @param {string} data.keywordMatched - Keyword that triggered reply
 * @param {boolean} data.commentReplied - Did we reply to comment?
 * @param {boolean} data.dmSent - Did we send DM?
 * @param {string} data.status - 'success' or 'failed'
 * @param {string} data.errorMessage - Error message if failed
 * @returns {Promise<Object>} - Database record
 */
const recordReply = async (data) => {
  try {
    const {
      postId,
      commentId,
      userId,
      username,
      keywordMatched,
      commentReplied = false,
      dmSent = false,
      status = 'success',
      errorMessage = null
    } = data;
    
    // Validate required fields
    if (!postId || !commentId || !userId) {
      throw new Error('Missing required fields: postId, commentId, userId');
    }
    
    const result = await db.query(
      `INSERT INTO replied_comments 
       (post_id, comment_id, user_id, username, keyword_matched, 
        comment_replied, dm_sent, status, error_message, replied_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (post_id, user_id) 
       DO UPDATE SET
         comment_id = EXCLUDED.comment_id,
         keyword_matched = EXCLUDED.keyword_matched,
         comment_replied = EXCLUDED.comment_replied,
         dm_sent = EXCLUDED.dm_sent,
         status = EXCLUDED.status,
         error_message = EXCLUDED.error_message,
         replied_at = NOW()
       RETURNING *`,
      [postId, commentId, userId, username, keywordMatched, 
       commentReplied, dmSent, status, errorMessage]
    );
    
    logger.info('✅ Reply recorded in database', {
      postId,
      userId,
      username,
      commentReplied,
      dmSent,
      status
    });
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('Failed to record reply:', {
      data,
      error: error.message
    });
    throw error;
  }
};

/**
 * Record a failed reply attempt
 * This helps with debugging and prevents infinite retries
 * 
 * @param {Object} data - Similar to recordReply
 * @returns {Promise<Object>}
 */
const recordFailedReply = async (data) => {
  return recordReply({
    ...data,
    status: 'failed',
    commentReplied: false,
    dmSent: false
  });
};

// ============================================
// ANALYTICS & CLEANUP
// ============================================

/**
 * Get reply statistics for a post
 * Used in dashboard to show performance
 * 
 * @param {string} postId - Our internal post UUID
 * @returns {Promise<Object>} - Stats object
 */
const getPostReplyStats = async (postId) => {
  try {
    const result = await db.query(
      `SELECT 
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(*) as total_replies,
         SUM(CASE WHEN comment_replied THEN 1 ELSE 0 END) as comments_replied,
         SUM(CASE WHEN dm_sent THEN 1 ELSE 0 END) as dms_sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
         MAX(replied_at) as last_reply_at,
         MIN(replied_at) as first_reply_at
       FROM replied_comments 
       WHERE post_id = $1`,
      [postId]
    );
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('Failed to get reply stats:', {
      postId,
      error: error.message
    });
    return null;
  }
};

/**
 * Get overall statistics across all posts
 * @returns {Promise<Object>}
 */
const getOverallStats = async () => {
  try {
    const result = await db.query(
      `SELECT 
         COUNT(DISTINCT user_id) as total_unique_users,
         COUNT(*) as total_replies,
         SUM(CASE WHEN comment_replied THEN 1 ELSE 0 END) as total_comments_replied,
         SUM(CASE WHEN dm_sent THEN 1 ELSE 0 END) as total_dms_sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failures,
         COUNT(DISTINCT post_id) as active_posts
       FROM replied_comments
       WHERE replied_at > NOW() - INTERVAL '30 days'`
    );
    
    return result.rows[0];
    
  } catch (error) {
    logger.error('Failed to get overall stats:', error);
    return null;
  }
};

/**
 * Clean up old reply records (older than 90 days)
 * Run this periodically to keep database lean
 * 
 * @returns {Promise<number>} - Number of deleted records
 */
const cleanupOldRecords = async (daysToKeep = 90) => {
  try {
    const result = await db.query(
      `DELETE FROM replied_comments 
       WHERE replied_at < NOW() - INTERVAL '${daysToKeep} days'
       RETURNING id`,
      []
    );
    
    const deletedCount = result.rowCount;
    
    if (deletedCount > 0) {
      logger.info(`🗑️  Cleaned up ${deletedCount} old reply records`);
    }
    
    return deletedCount;
    
  } catch (error) {
    logger.error('Failed to cleanup old records:', error);
    return 0;
  }
};

/**
 * Get list of users who have been replied to on a specific post
 * Useful for debugging and admin panel
 * 
 * @param {string} postId
 * @param {number} limit
 * @returns {Promise<Array>}
 */
const getRepliedUsers = async (postId, limit = 100) => {
  try {
    const result = await db.query(
      `SELECT 
         user_id,
         username,
         keyword_matched,
         comment_replied,
         dm_sent,
         status,
         replied_at
       FROM replied_comments 
       WHERE post_id = $1
       ORDER BY replied_at DESC
       LIMIT $2`,
      [postId, limit]
    );
    
    return result.rows;
    
  } catch (error) {
    logger.error('Failed to get replied users:', {
      postId,
      error: error.message
    });
    return [];
  }
};

// ============================================
// SAFEGUARDS
// ============================================

/**
 * Check if we're replying too fast to the same post
 * Prevents accidental spam if webhook fires rapidly
 * 
 * @param {string} postId
 * @param {number} windowSeconds - Time window to check (default 10 seconds)
 * @returns {Promise<number>} - Number of replies in window
 */
const getRecentReplyCount = async (postId, windowSeconds = 10) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM replied_comments
       WHERE post_id = $1 
         AND replied_at > NOW() - INTERVAL '${windowSeconds} seconds'`,
      [postId]
    );
    
    return parseInt(result.rows[0].count);
    
  } catch (error) {
    logger.error('Failed to check recent reply count:', error);
    return 0;
  }
};

/**
 * Rate limiting safeguard
 * If more than X replies in Y seconds, something is wrong
 * 
 * @param {string} postId
 * @returns {Promise<boolean>} - True if rate limit exceeded
 */
const isRateLimitExceeded = async (postId) => {
  const recentCount = await getRecentReplyCount(postId, 60); // Last minute
  const threshold = 50; // Max 50 replies per minute per post
  
  if (recentCount >= threshold) {
    logger.error('⚠️  RATE LIMIT EXCEEDED - Too many replies too fast!', {
      postId,
      recentCount,
      threshold
    });
    return true;
  }
  
  return false;
};

module.exports = {
  // Deduplication
  hasAlreadyReplied,
  hasProcessedComment,
  
  // Recording
  recordReply,
  recordFailedReply,
  
  // Analytics
  getPostReplyStats,
  getOverallStats,
  getRepliedUsers,
  
  // Cleanup
  cleanupOldRecords,
  
  // Safeguards
  getRecentReplyCount,
  isRateLimitExceeded
};