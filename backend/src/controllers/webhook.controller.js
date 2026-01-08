/**
 * Webhook Controller
 * Handles Instagram webhook events
 * 
 * Instagram sends webhooks for:
 * - New comments on posts
 * - Mentions
 * - Story mentions
 * - etc.
 * 
 * This controller validates the webhook and queues comments for processing
 */

const { addCommentToQueue } = require('../services/queue.service');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// WEBHOOK VERIFICATION (GET request)
// ============================================

/**
 * Verify webhook subscription
 * Instagram sends a GET request when you first set up the webhook
 * We must echo back the challenge to confirm
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.send(challenge);
  }

  return res.sendStatus(403);
};

// ============================================
// WEBHOOK EVENT HANDLER (POST request)
// ============================================

/**
 * Handle incoming webhook events
 * Instagram POSTs here when someone comments on your post
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const handleWebhook = async (req, res) => {
  try {
    const body = req.body;
    
    // Log the webhook (useful for debugging)
    logger.info('📨 Webhook received', {
      object: body.object,
      entries: body.entry?.length || 0
    });
    
    // Verify this is an Instagram webhook
    if (body.object !== 'instagram') {
      logger.warn('Unknown webhook object type', { object: body.object });
      return res.sendStatus(400);
    }
    
    // Process all entries in the webhook
    // Instagram can batch multiple events into one webhook
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        await processWebhookEntry(entry);
      }
    }
    
    // IMPORTANT: Always respond with 200 immediately
    // Instagram expects fast response (<5 seconds)
    // Actual processing happens asynchronously in the queue
    res.sendStatus(200);
    
  } catch (error) {
    logger.error('Webhook processing error:', error);
    
    // Still return 200 to prevent Instagram from retrying
    // Log the error and investigate later
    res.sendStatus(200);
  }
};

/**
 * Process a single webhook entry
 * Each entry can contain multiple changes (comments, mentions, etc.)
 * 
 * @param {Object} entry - Webhook entry
 */
const processWebhookEntry = async (entry) => {
  try {
    const changes = entry.changes || [];
    
    for (const change of changes) {
      // We only care about comments
      if (change.field === 'comments') {
        await processCommentWebhook(change.value);
      } else {
        logger.debug('Ignoring non-comment webhook', {
          field: change.field
        });
      }
    }
    
  } catch (error) {
    logger.error('Error processing webhook entry:', {
      entry,
      error: error.message
    });
  }
};

/**
 * Process a comment webhook event
 * This is where the magic starts
 * 
 * @param {Object} commentData - Comment data from webhook
 */
const processCommentWebhook = async (commentData) => {
  try {
    // Extract comment details
    const {
      id: commentId,
      text,
      from, // User who commented
      media // Post that was commented on
    } = commentData;
    
    if (!commentId || !text || !from || !media) {
      logger.warn('Incomplete comment data in webhook', { commentData });
      return;
    }
    
    const userId = from.id;
    const username = from.username;
    const mediaId = media.id;
    
    logger.info('New comment detected', {
      commentId,
      username,
      mediaId,
      text: text.substring(0, 50) + '...'
    });
    
    // ============================================
    // FIND OUR INTERNAL POST RECORD
    // ============================================
    
    // Check if we're tracking this post in our database
    const postResult = await query(
      `SELECT id, is_active 
       FROM posts 
       WHERE media_id = $1`,
      [mediaId]
    );
    
    if (postResult.rows.length === 0) {
      logger.debug('Comment on untracked post, ignoring', {
        mediaId,
        commentId
      });
      return;
    }
    
    const post = postResult.rows[0];
    
    // Check if automation is active for this post
    if (!post.is_active) {
      logger.debug('Automation disabled for this post, ignoring', {
        mediaId,
        postId: post.id
      });
      return;
    }
    
    // ============================================
    // ADD TO QUEUE FOR PROCESSING
    // ============================================
    
    // Add comment to Bull queue
    // This ensures we don't overwhelm Instagram API
    // and handles retries automatically
    await addCommentToQueue({
      commentId,
      text,
      username,
      userId,
      mediaId,
      postId: post.id
    });
    
    logger.info('✅ Comment queued for processing', {
      commentId,
      username,
      postId: post.id
    });
    
  } catch (error) {
    logger.error('Error processing comment webhook:', {
      commentData,
      error: error.message
    });
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook
};