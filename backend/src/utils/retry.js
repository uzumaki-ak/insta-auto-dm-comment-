/**
 * Retry Utility
 * Implements exponential backoff retry logic
 * Critical for handling Instagram API rate limits and transient failures
 */

const logger = require('./logger');

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 * 
 * Example:
 * const result = await retryWithBackoff(
 *   () => instagramApi.get('/media'),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {number} options.backoffMultiplier - Delay multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if should retry
 * @param {Function} options.onRetry - Callback called before each retry
 * @returns {Promise} - Result of successful function call
 * @throws {Error} - Throws last error if all retries fail
 */
const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
    onRetry = null
  } = options;
  
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try executing the function
      const result = await fn();
      
      // Success! Return result
      if (attempt > 0) {
        logger.info('✅ Retry succeeded', {
          attempt,
          totalAttempts: attempt + 1
        });
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        logger.debug('Error not retryable', {
          error: error.message
        });
        throw error;
      }
      
      // Check if we've exhausted retries
      if (attempt === maxRetries) {
        logger.error('❌ All retry attempts exhausted', {
          attempts: maxRetries + 1,
          error: error.message
        });
        throw error;
      }
      
      // Log retry attempt
      logger.warn('⚠️  Attempt failed, retrying...', {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        error: error.message,
        delayMs: delay
      });
      
      // Call onRetry callback if provided
      if (onRetry) {
        await onRetry(attempt, error);
      }
      
      // Wait before retrying (exponential backoff)
      await sleep(delay);
      
      // Increase delay for next retry
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }
  
  // This should never be reached, but just in case
  throw lastError;
};

/**
 * Retry with linear backoff (constant delay)
 * Simpler than exponential, useful for less critical operations
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} options.maxRetries - Max attempts (default: 3)
 * @param {number} options.delay - Delay between retries in ms (default: 2000)
 * @returns {Promise}
 */
const retryWithLinearBackoff = async (fn, options = {}) => {
  const { maxRetries = 3, delay = 2000 } = options;
  
  return retryWithBackoff(fn, {
    maxRetries,
    initialDelay: delay,
    backoffMultiplier: 1 // No increase, constant delay
  });
};

/**
 * Retry with custom backoff strategy
 * Allows full control over retry delays
 * 
 * @param {Function} fn - Async function to retry
 * @param {Array<number>} delays - Array of delays in ms for each retry
 * @returns {Promise}
 */
const retryWithCustomBackoff = async (fn, delays = [1000, 2000, 5000]) => {
  let lastError;
  
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === delays.length) {
        throw error;
      }
      
      const delayMs = delays[attempt];
      logger.warn('Retrying with custom backoff', {
        attempt: attempt + 1,
        delayMs
      });
      
      await sleep(delayMs);
    }
  }
  
  throw lastError;
};

/**
 * Execute function with timeout
 * Throws error if function takes longer than timeout
 * 
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Custom error message
 * @returns {Promise}
 */
const withTimeout = async (fn, timeoutMs, errorMessage = 'Operation timed out') => {
  return Promise.race([
    fn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

/**
 * Circuit breaker pattern
 * Stops trying if too many consecutive failures
 * Useful for protecting against cascading failures
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      
      // Try to close circuit
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      
      logger.error('Circuit breaker opened', {
        failures: this.failures,
        resetTimeout: this.resetTimeout
      });
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt: this.nextAttempt
    };
  }
}

module.exports = {
  retryWithBackoff,
  retryWithLinearBackoff,
  retryWithCustomBackoff,
  withTimeout,
  CircuitBreaker,
  sleep
};