/**
 * Queue Service - Rate Limiting & Job Processing
 * Uses Bull queue with Redis to handle high volume (2000+ comments)
 * Prevents Instagram API rate limits and ensures reliable processing
 * 
 * Why Bull Queue?
 * - Handles 2000+ comments without overwhelming Instagram API
 * - Automatic retries on failure
 * - Rate limiting built-in
 * - Persistent (Redis) - survives server restarts
 */

const Queue = require('bull');
const logger = require('../utils/logger');

// Initialize Redis connection for Bull


// Create queue for processing comments
// This queue will handle all comment replies with rate limiting
console.log("🔥 REDIS_URL seen by queue:", process.env.REDIS_URL);

const commentQueue = new Queue(
  'instagram-comments',
  process.env.REDIS_URL,
  {
    redis: {
      tls: {
        rejectUnauthorized: false
      }
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: 100,
      removeOnFail: false
    }
  }
);



// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

// Instagram allows ~200 API calls per hour per token
// We set it to 180 to be safe (90% of limit)
const MAX_REQUESTS_PER_HOUR = parseInt(process.env.MAX_REQUESTS_PER_HOUR) || 180;

// How many jobs can run simultaneously
// Too high = might hit rate limit, Too low = slow processing
const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY) || 5;

// Rate limiter settings
const RATE_LIMITER = {
  max: MAX_REQUESTS_PER_HOUR, // Max requests
  duration: 3600000, // Per hour (in milliseconds)
  bounceBack: false // Don't reject, just delay
};

// Apply rate limiting to the queue
commentQueue.on('ready', () => {
  logger.info('✅ Comment queue ready', {
    concurrency: CONCURRENCY,
    rateLimit: `${MAX_REQUESTS_PER_HOUR} requests/hour`
  });
});

// ============================================
// ERROR HANDLING & MONITORING
// ============================================

// Log when job completes successfully
commentQueue.on('completed', (job, result) => {
  logger.info('✅ Comment processed successfully', {
    jobId: job.id,
    commentId: job.data.commentId,
    username: job.data.username,
    duration: Date.now() - job.timestamp
  });
});

// Log when job fails (after all retries exhausted)
commentQueue.on('failed', (job, err) => {
  logger.error('❌ Comment processing failed', {
    jobId: job.id,
    commentId: job.data.commentId,
    username: job.data.username,
    error: err.message,
    attemptsMade: job.attemptsMade,
    data: job.data
  });
});

// Log when job is retrying
commentQueue.on('retrying', (job) => {
  logger.warn('🔄 Retrying comment processing', {
    jobId: job.id,
    commentId: job.data.commentId,
    attempt: job.attemptsMade + 1,
    maxAttempts: job.opts.attempts
  });
});

// Log queue stalling (jobs taking too long)
commentQueue.on('stalled', (job) => {
  logger.warn('⚠️  Job stalled (taking too long)', {
    jobId: job.id,
    commentId: job.data.commentId
  });
});

// Monitor queue health
commentQueue.on('error', (error) => {
  logger.error('❌ Queue error:', error);
});

// ============================================
// PUBLIC METHODS
// ============================================

/**
 * Add a comment to the processing queue
 * This is called when Instagram sends a webhook
 * 
 * @param {Object} commentData - Comment data from Instagram webhook
 * @param {string} commentData.commentId - Instagram comment ID
 * @param {string} commentData.text - Comment text
 * @param {string} commentData.username - Commenter's username
 * @param {string} commentData.userId - Commenter's Instagram user ID
 * @param {string} commentData.mediaId - Post/media ID
 * @param {string} commentData.postId - Our internal post ID (UUID)
 * @returns {Promise<Object>} - Bull job object
 */
const addCommentToQueue = async (commentData) => {
  try {
    // Validate required fields
    const requiredFields = ['commentId', 'text', 'userId', 'mediaId', 'postId'];
    const missingFields = requiredFields.filter(field => !commentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Add job to queue with unique job ID (prevents duplicate processing)
    const job = await commentQueue.add(commentData, {
      jobId: `comment-${commentData.commentId}`, // Unique ID prevents duplicates
      priority: 1, // Higher number = higher priority (useful for VIP users later)
      timeout: 30000, // 30 second timeout per job
    });
    
    logger.info('📥 Comment added to queue', {
      jobId: job.id,
      commentId: commentData.commentId,
      username: commentData.username,
      queueLength: await commentQueue.count()
    });
    
    return job;
    
  } catch (error) {
    // If it's a duplicate job ID, that's actually OK (idempotency)
    if (error.message.includes('Job already exists')) {
      logger.debug('Comment already in queue (idempotent)', {
        commentId: commentData.commentId
      });
      return null;
    }
    
    logger.error('Failed to add comment to queue:', {
      error: error.message,
      commentData
    });
    throw error;
  }
};

/**
 * Get queue statistics
 * Useful for monitoring and dashboard
 * 
 * @returns {Promise<Object>} - Queue stats
 */
const getQueueStats = async () => {
  try {
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused
    ] = await Promise.all([
      commentQueue.getWaitingCount(),
      commentQueue.getActiveCount(),
      commentQueue.getCompletedCount(),
      commentQueue.getFailedCount(),
      commentQueue.getDelayedCount(),
      commentQueue.getPausedCount()
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + delayed
    };
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    return null;
  }
};

/**
 * Pause queue processing
 * Useful for maintenance or if Instagram API is down
 */
const pauseQueue = async () => {
  await commentQueue.pause();
  logger.warn('⏸️  Queue paused');
};

/**
 * Resume queue processing
 */
const resumeQueue = async () => {
  await commentQueue.resume();
  logger.info('▶️  Queue resumed');
};

/**
 * Clear all jobs from queue
 * DANGEROUS - only use for testing/debugging
 */
const clearQueue = async () => {
  await commentQueue.empty();
  logger.warn('🗑️  Queue cleared');
};

/**
 * Graceful shutdown
 * Waits for active jobs to complete before closing
 */
const shutdown = async () => {
  logger.info('Shutting down queue gracefully...');
  await commentQueue.close();
  logger.info('Queue closed');
};

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if queue is healthy
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    const stats = await getQueueStats();
    const isHealthy = stats !== null && !await commentQueue.isPaused();
    
    if (!isHealthy) {
      logger.warn('Queue health check failed');
    }
    
    return isHealthy;
  } catch (error) {
    logger.error('Queue health check error:', error);
    return false;
  }
};

module.exports = {
  commentQueue,
  addCommentToQueue,
  getQueueStats,
  pauseQueue,
  resumeQueue,
  clearQueue,
  shutdown,
  healthCheck,
  CONCURRENCY,
  RATE_LIMITER
};