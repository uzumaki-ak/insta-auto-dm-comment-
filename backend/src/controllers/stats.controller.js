/**
 * Stats Controller
 * Provides analytics and statistics for the dashboard
 */

const deduplicationService = require('../services/deduplication.service');
const { getQueueStats } = require('../services/queue.service');
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get overall statistics
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getOverallStats = async (req, res) => {
  try {
    // Get database stats
    const dbStats = await deduplicationService.getOverallStats();
    
    // Get queue stats
    const queueStats = await getQueueStats();
    
    res.json({
      success: true,
      stats: {
        database: dbStats,
        queue: queueStats
      }
    });
    
  } catch (error) {
    logger.error('Failed to get overall stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

/**
 * Get statistics for a specific post
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getPostStats = async (req, res) => {
  try {
    const { postId } = req.params;
    
    const stats = await deduplicationService.getPostReplyStats(postId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    logger.error('Failed to get post stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post statistics'
    });
  }
};

/**
 * Get recent replied users for a post
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getRecentReplies = async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const replies = await deduplicationService.getRepliedUsers(postId, limit);
    
    res.json({
      success: true,
      replies
    });
    
  } catch (error) {
    logger.error('Failed to get recent replies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent replies'
    });
  }
};

module.exports = {
  getOverallStats,
  getPostStats,
  getRecentReplies
};