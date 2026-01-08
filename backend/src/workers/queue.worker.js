/**
 * Queue Worker
 * Processes comments from Bull queue
 * This is where comments actually get replied to
 * 
 * IMPORTANT: This file needs to be run as a separate process
 * or included in the main server
 */

const { commentQueue, CONCURRENCY, RATE_LIMITER } = require('../services/queue.service');
const { processComment } = require('../services/comment.processor');
const logger = require('../utils/logger');

/**
 * Start processing jobs from the queue
 * This runs continuously in the background
 */
const startQueueWorker = () => {
  logger.info('🔄 Starting queue worker...', {
    concurrency: CONCURRENCY,
    rateLimit: RATE_LIMITER
  });
  
  // Process jobs with specified concurrency
  // Concurrency = how many jobs can run simultaneously
  commentQueue.process(CONCURRENCY, async (job) => {
    try {
      logger.debug('📥 Job picked up from queue', {
        jobId: job.id,
        commentId: job.data.commentId
      });
      
      // Process the comment (this is the main logic)
      const result = await processComment(job);
      
      return result;
      
    } catch (error) {
      logger.error('Job processing failed:', {
        jobId: job.id,
        error: error.message
      });
      
      // Throw error to trigger Bull's retry mechanism
      throw error;
    }
  });
  
  // ============================================
  // QUEUE EVENT HANDLERS
  // ============================================
  
  commentQueue.on('completed', (job, result) => {
    logger.info('✅ Job completed', {
      jobId: job.id,
      commentId: job.data.commentId,
      result
    });
  });
  
  commentQueue.on('failed', (job, error) => {
    logger.error('❌ Job failed after all retries', {
      jobId: job.id,
      commentId: job.data.commentId,
      error: error.message,
      attempts: job.attemptsMade
    });
  });
  
  commentQueue.on('stalled', (job) => {
    logger.warn('⚠️  Job stalled', {
      jobId: job.id,
      commentId: job.data.commentId
    });
  });
  
  commentQueue.on('error', (error) => {
    logger.error('❌ Queue error:', error);
  });
  
  logger.info('✅ Queue worker started successfully');
};

/**
 * Graceful shutdown
 * Wait for active jobs to complete
 */
const stopQueueWorker = async () => {
  logger.info('Stopping queue worker...');
  
  try {
    await commentQueue.close();
    logger.info('✅ Queue worker stopped gracefully');
  } catch (error) {
    logger.error('Error stopping queue worker:', error);
  }
};

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await stopQueueWorker();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received');
  await stopQueueWorker();
  process.exit(0);
});

module.exports = {
  startQueueWorker,
  stopQueueWorker
};