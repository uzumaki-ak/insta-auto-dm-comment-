/**
 * Post Model
 * Database queries for posts table
 * Centralizes all post-related database operations
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all posts with aggregated data
 * @returns {Promise<Array>}
 */
const getAllPosts = async () => {
  return query(
    `SELECT 
       p.*,
       COUNT(DISTINCT k.id) as keyword_count,
       COUNT(DISTINCT rc.user_id) as replies_count,
       MAX(rc.replied_at) as last_reply_at
     FROM posts p
     LEFT JOIN keywords k ON p.id = k.post_id
     LEFT JOIN replied_comments rc ON p.id = rc.post_id
     GROUP BY p.id
     ORDER BY p.created_at DESC`
  );
};

/**
 * Get post by ID
 * @param {string} postId - Post UUID
 * @returns {Promise<Object|null>}
 */
const getPostById = async (postId) => {
  const result = await query(
    `SELECT * FROM posts WHERE id = $1`,
    [postId]
  );
  return result.rows[0] || null;
};

/**
 * Get post by Instagram media ID
 * @param {string} mediaId - Instagram media ID
 * @returns {Promise<Object|null>}
 */
const getPostByMediaId = async (mediaId) => {
  const result = await query(
    `SELECT * FROM posts WHERE media_id = $1`,
    [mediaId]
  );
  return result.rows[0] || null;
};

/**
 * Create a new post
 * @param {Object} postData - Post data
 * @returns {Promise<Object>}
 */
const createPost = async (postData) => {
  const {
    media_id,
    media_type,
    caption = '',
    media_url = null,
    permalink = null,
    is_active = true
  } = postData;
  
  const result = await query(
    `INSERT INTO posts (media_id, media_type, caption, media_url, permalink, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [media_id, media_type, caption, media_url, permalink, is_active]
  );
  
  return result.rows[0];
};

/**
 * Update post
 * @param {string} postId - Post UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
const updatePost = async (postId, updates) => {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  
  // Build SET clause dynamically
  const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
  
  const result = await query(
    `UPDATE posts SET ${setClause}, updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [postId, ...values]
  );
  
  return result.rows[0];
};

/**
 * Delete post
 * @param {string} postId - Post UUID
 * @returns {Promise<boolean>}
 */
const deletePost = async (postId) => {
  const result = await query(
    `DELETE FROM posts WHERE id = $1`,
    [postId]
  );
  return result.rowCount > 0;
};

/**
 * Toggle post active status
 * @param {string} postId - Post UUID
 * @param {boolean} isActive - New active status
 * @returns {Promise<Object>}
 */
const toggleActive = async (postId, isActive) => {
  const result = await query(
    `UPDATE posts SET is_active = $1, updated_at = NOW() 
     WHERE id = $2 
     RETURNING *`,
    [isActive, postId]
  );
  return result.rows[0];
};

module.exports = {
  getAllPosts,
  getPostById,
  getPostByMediaId,
  createPost,
  updatePost,
  deletePost,
  toggleActive
};