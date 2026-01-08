/**
 * Comment Processor Service - THE ORCHESTRATOR
 * This is the most critical file - it coordinates everything
 * 
 * Flow:
 * 1. Receive comment data from webhook
 * 2. Check deduplication (already replied?)
 * 3. Match keywords
 * 4. Reply to comment
 * 5. Send DM (if configured)
 * 6. Record everything in database
 * 
 * This is designed to handle 2000+ comments without breaking
 */

const instagramService = require('./instagram.service');
const deduplicationService = require('./deduplication.service');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

/**
 * Process a single comment
 * This is called by the Bull queue worker
 * 
 * @param {Object} job - Bull job object
 * @param {Object} job.data - Comment data
 * @param {string} job.data.commentId - Instagram comment ID
 * @param {string} job.data.text - Comment text
 * @param {string} job.data.username - Commenter's username
 * @param {string} job.data.userId - Commenter's Instagram user ID
 * @param {string} job.data.mediaId - Instagram media (post) ID
 * @param {string} job.data.postId - Our internal post UUID
 * @returns {Promise<Object>} - Processing result
 */
const processComment = async (job) => {
  const startTime = Date.now();
  const { commentId, text, username, userId, mediaId, postId } = job.data;
  
  logger.info('🔄 Processing comment', {
    commentId,
    username,
    postId,
    text: text.substring(0, 50) + '...'
  });
  
  try {
    // ============================================
    // STEP 1: SAFEGUARDS - Check rate limits
    // ============================================
    
    const isRateLimited = await deduplicationService.isRateLimitExceeded(postId);
    if (isRateLimited) {
      logger.error('🛑 Rate limit exceeded - aborting', { postId });
      throw new Error('Rate limit safety threshold exceeded');
    }
    
    // ============================================
    // STEP 2: DEDUPLICATION - Already replied?
    // ============================================
    
    // Check by user ID (most important - prevents multiple replies to same user)
    const alreadyRepliedToUser = await deduplicationService.hasAlreadyReplied(postId, userId);
    if (alreadyRepliedToUser) {
      logger.info('⏭️  Already replied to this user, skipping', {
        commentId,
        username,
        postId
      });
      return {
        skipped: true,
        reason: 'already_replied_to_user'
      };
    }
    
    // Check by comment ID (prevents duplicate processing if webhook fires twice)
    const alreadyProcessedComment = await deduplicationService.hasProcessedComment(commentId);
    if (alreadyProcessedComment) {
      logger.info('⏭️  Already processed this comment, skipping', {
        commentId,
        username
      });
      return {
        skipped: true,
        reason: 'already_processed_comment'
      };
    }
    
    // ============================================
    // STEP 3: KEYWORD MATCHING - Should we reply?
    // ============================================
    
    const matchedKeyword = await findMatchingKeyword(postId, text);
    
    if (!matchedKeyword) {
      logger.debug('No keyword match, skipping', {
        commentId,
        text,
        postId
      });
      return {
        skipped: true,
        reason: 'no_keyword_match'
      };
    }
    
    logger.info('✅ Keyword matched!', {
      keyword: matchedKeyword.keyword,
      commentId,
      username
    });
    
    // ============================================
    // STEP 4: REPLY TO COMMENT
    // ============================================
    
    let commentReplied = false;
    let dmSent = false;
    let errorMessage = null;
    
    try {
      // Reply publicly to the comment
      if (matchedKeyword.comment_reply) {
        await instagramService.replyToComment(
          commentId,
          matchedKeyword.comment_reply
        );
        commentReplied = true;
        
        logger.info('✅ Comment reply posted', {
          commentId,
          username
        });
      }
      
      // ============================================
      // STEP 5: SEND DM (if configured)
      // ============================================
      
      if (matchedKeyword.dm_message) {
        try {
          await instagramService.sendDirectMessage(
            userId,
            matchedKeyword.dm_message
          );
          dmSent = true;
          
          logger.info('✅ DM sent', {
            userId,
            username
          });
          
        } catch (dmError) {
          // DM can fail (24hr window, privacy settings, etc.)
          // This is NOT a critical error - log it but mark reply as success
          logger.warn('⚠️  DM failed but comment reply succeeded', {
            userId,
            username,
            error: dmError.message
          });
          
          errorMessage = `DM failed: ${dmError.message}`;
        }
      }
      
    } catch (replyError) {
      // Comment reply failed - this IS critical
      logger.error('❌ Failed to reply to comment', {
        commentId,
        username,
        error: replyError.message
      });
      
      // Record the failure
      await deduplicationService.recordFailedReply({
        postId,
        commentId,
        userId,
        username,
        keywordMatched: matchedKeyword.keyword,
        errorMessage: replyError.message
      });
      
      throw replyError; // Propagate error for Bull to retry
    }
    
    // ============================================
    // STEP 6: RECORD SUCCESS IN DATABASE
    // ============================================
    
    await deduplicationService.recordReply({
      postId,
      commentId,
      userId,
      username,
      keywordMatched: matchedKeyword.keyword,
      commentReplied,
      dmSent,
      status: 'success',
      errorMessage
    });
    
    // ============================================
    // STEP 7: UPDATE STATS (optional but useful)
    // ============================================
    
    await updatePostStats(postId);
    
    const processingTime = Date.now() - startTime;
    
    logger.info('✅ Comment processed successfully', {
      commentId,
      username,
      processingTime: `${processingTime}ms`,
      commentReplied,
      dmSent
    });
    
    return {
      success: true,
      commentReplied,
      dmSent,
      processingTime,
      keyword: matchedKeyword.keyword
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('❌ Comment processing failed', {
      commentId,
      username,
      error: error.message,
      processingTime: `${processingTime}ms`
    });
    
    // Throw error to trigger Bull retry mechanism
    throw error;
  }
};

// ============================================
// KEYWORD MATCHING LOGIC
// ============================================

/**
 * Find matching keyword for a comment
 * Supports case-sensitive and case-insensitive matching
 * 
 * @param {string} postId - Our internal post UUID
 * @param {string} commentText - Comment text to check
 * @returns {Promise<Object|null>} - Matched keyword config or null
 */
const findMatchingKeyword = async (postId, commentText) => {
  try {
    // Get all keywords for this post from database
    const result = await query(
      `SELECT k.* 
       FROM keywords k
       JOIN posts p ON k.post_id = p.id
       WHERE p.id = $1 AND p.is_active = true`,
      [postId]
    );
    
    if (result.rows.length === 0) {
      logger.debug('No keywords configured for this post', { postId });
      return null;
    }
    
    const keywords = result.rows;
    
    // Check each keyword for a match
    for (const keywordConfig of keywords) {
      const { keyword, case_sensitive } = keywordConfig;
      
      let isMatch = false;
      
      if (case_sensitive) {
        // Exact case match
        isMatch = commentText.includes(keyword);
      } else {
        // Case-insensitive match
        isMatch = commentText.toLowerCase().includes(keyword.toLowerCase());
      }
      
      if (isMatch) {
        logger.debug('Keyword matched', {
          keyword,
          commentText,
          case_sensitive
        });
        return keywordConfig;
      }
    }
    
    // No keyword matched
    return null;
    
  } catch (error) {
    logger.error('Error finding matching keyword:', {
      postId,
      error: error.message
    });
    return null;
  }
};

// ============================================
// STATS TRACKING
// ============================================

/**
 * Update statistics for a post
 * This is called after successful processing
 * Updates daily aggregated stats
 * 
 * @param {string} postId - Our internal post UUID
 */
const updatePostStats = async (postId) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    await query(
      `INSERT INTO stats (post_id, date, total_replies)
       VALUES ($1, $2, 1)
       ON CONFLICT (post_id, date)
       DO UPDATE SET
         total_replies = stats.total_replies + 1,
         updated_at = NOW()`,
      [postId, today]
    );
    
  } catch (error) {
    // Stats update failing should not break the main flow
    logger.warn('Failed to update stats (non-critical):', {
      postId,
      error: error.message
    });
  }
};

// ============================================
// BATCH PROCESSING (for manual sync)
// ============================================

/**
 * Process multiple comments at once
 * Useful if you miss webhooks and need to catch up
 * 
 * @param {string} mediaId - Instagram media ID
 * @param {string} postId - Our internal post UUID
 * @returns {Promise<Object>} - Results summary
 */
const batchProcessComments = async (mediaId, postId) => {
  try {
    logger.info('Starting batch comment processing', { mediaId, postId });
    
    // Fetch all comments from Instagram
    const comments = await instagramService.getMediaComments(mediaId, 100);
    
    logger.info(`Fetched ${comments.length} comments from Instagram`);
    
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    
    // Process each comment
    for (const comment of comments) {
      try {
        const result = await processComment({
          data: {
            commentId: comment.id,
            text: comment.text,
            username: comment.username,
            userId: comment.from?.id || comment.user?.id,
            mediaId,
            postId
          }
        });
        
        if (result.skipped) {
          skipped++;
        } else if (result.success) {
          processed++;
        }
        
        // Rate limiting: Don't overwhelm Instagram API
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between comments
        
      } catch (error) {
        logger.error('Failed to process comment in batch', {
          commentId: comment.id,
          error: error.message
        });
        failed++;
      }
    }
    
    logger.info('Batch processing complete', {
      total: comments.length,
      processed,
      skipped,
      failed
    });
    
    return {
      total: comments.length,
      processed,
      skipped,
      failed
    };
    
  } catch (error) {
    logger.error('Batch processing failed:', {
      mediaId,
      postId,
      error: error.message
    });
    throw error;
  }
};

module.exports = {
  processComment,
  findMatchingKeyword,
  batchProcessComments,
  updatePostStats
};