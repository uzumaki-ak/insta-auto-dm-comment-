/**
 * Keyword Model
 * Database queries for keywords table
 */

const { query } = require('../config/database');

/**
 * Get all keywords for a post
 * @param {string} postId - Post UUID
 * @returns {Promise<Array>}
 */
const getKeywordsByPostId = async (postId) => {
  const result = await query(
    `SELECT * FROM keywords WHERE post_id = $1 ORDER BY created_at DESC`,
    [postId]
  );
  return result.rows;
};

/**
 * Get keyword by ID
 * @param {string} keywordId - Keyword UUID
 * @returns {Promise<Object|null>}
 */
const getKeywordById = async (keywordId) => {
  const result = await query(
    `SELECT * FROM keywords WHERE id = $1`,
    [keywordId]
  );
  return result.rows[0] || null;
};

/**
 * Create keyword
 * @param {Object} keywordData
 * @returns {Promise<Object>}
 */
const createKeyword = async (keywordData) => {
  const {
    post_id,
    keyword,
    case_sensitive = false,
    comment_reply,
    dm_message = null
  } = keywordData;
  
  const result = await query(
    `INSERT INTO keywords (post_id, keyword, case_sensitive, comment_reply, dm_message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (post_id, keyword) 
     DO UPDATE SET
       case_sensitive = EXCLUDED.case_sensitive,
       comment_reply = EXCLUDED.comment_reply,
       dm_message = EXCLUDED.dm_message
     RETURNING *`,
    [post_id, keyword, case_sensitive, comment_reply, dm_message]
  );
  
  return result.rows[0];
};

/**
 * Update keyword
 * @param {string} keywordId - Keyword UUID
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
const updateKeyword = async (keywordId, updates) => {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  
  const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
  
  const result = await query(
    `UPDATE keywords SET ${setClause} WHERE id = $1 RETURNING *`,
    [keywordId, ...values]
  );
  
  return result.rows[0];
};

/**
 * Delete keyword
 * @param {string} keywordId - Keyword UUID
 * @returns {Promise<boolean>}
 */
const deleteKeyword = async (keywordId) => {
  const result = await query(
    `DELETE FROM keywords WHERE id = $1`,
    [keywordId]
  );
  return result.rowCount > 0;
};

/**
 * Delete all keywords for a post
 * @param {string} postId - Post UUID
 * @returns {Promise<number>} - Number of deleted keywords
 */
const deleteKeywordsByPostId = async (postId) => {
  const result = await query(
    `DELETE FROM keywords WHERE post_id = $1`,
    [postId]
  );
  return result.rowCount;
};

module.exports = {
  getKeywordsByPostId,
  getKeywordById,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  deleteKeywordsByPostId
};