/**
 * Reply Model
 * Database queries for replied_comments table
 */

const { query } = require('../config/database');

/**
 * Check if already replied to user on post
 * @param {string} postId - Post UUID
 * @param {string} userId - Instagram user ID
 * @returns {Promise<boolean>}
 */
const hasReplied = async (postId, userId) => {
  const result = await query(
    `SELECT id FROM replied_comments 
     WHERE post_id = $1 AND user_id = $2 
     LIMIT 1`,
    [postId, userId]
  );
  return result.rows.length > 0;
};

/**
 * Get reply record
 * @param {string} postId - Post UUID
 * @param {string} userId - Instagram user ID
 * @returns {Promise<Object|null>}
 */
const getReply = async (postId, userId) => {
  const result = await query(
    `SELECT * FROM replied_comments 
     WHERE post_id = $1 AND user_id = $2 
     LIMIT 1`,
    [postId, userId]
  );
  return result.rows[0] || null;
};

/**
 * Create reply record
 * @param {Object} replyData
 * @returns {Promise<Object>}
 */
const createReply = async (replyData) => {
  const {
    post_id,
    comment_id,
    user_id,
    username,
    keyword_matched,
    comment_replied = false,
    dm_sent = false,
    status = 'success',
    error_message = null
  } = replyData;
  
  const result = await query(
    `INSERT INTO replied_comments 
     (post_id, comment_id, user_id, username, keyword_matched, 
      comment_replied, dm_sent, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    [post_id, comment_id, user_id, username, keyword_matched, 
     comment_replied, dm_sent, status, error_message]
  );
  
  return result.rows[0];
};

/**
 * Get all replies for a post
 * @param {string} postId - Post UUID
 * @param {number} limit - Max results
 * @returns {Promise<Array>}
 */
const getRepliesByPostId = async (postId, limit = 100) => {
  const result = await query(
    `SELECT * FROM replied_comments 
     WHERE post_id = $1 
     ORDER BY replied_at DESC 
     LIMIT $2`,
    [postId, limit]
  );
  return result.rows;
};

/**
 * Get reply statistics for a post
 * @param {string} postId - Post UUID
 * @returns {Promise<Object>}
 */
const getPostStats = async (postId) => {
  const result = await query(
    `SELECT 
       COUNT(DISTINCT user_id) as unique_users,
       COUNT(*) as total_replies,
       SUM(CASE WHEN comment_replied THEN 1 ELSE 0 END) as comments_replied,
       SUM(CASE WHEN dm_sent THEN 1 ELSE 0 END) as dms_sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
       MAX(replied_at) as last_reply_at
     FROM replied_comments 
     WHERE post_id = $1`,
    [postId]
  );
  return result.rows[0];
};

module.exports = {
  hasReplied,
  getReply,
  createReply,
  getRepliesByPostId,
  getPostStats
};