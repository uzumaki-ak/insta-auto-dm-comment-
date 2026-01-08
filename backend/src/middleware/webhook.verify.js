/**
 * Webhook Verification Middleware
 * Validates that webhook requests are actually from Instagram/Meta
 * Uses HMAC SHA256 signature verification
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verify webhook signature from Instagram
 * Instagram signs each webhook with your app secret
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const verifyWebhookSignature = (req, res, next) => {
  try {
    // Skip verification in development if app secret not set
    if (!process.env.META_APP_SECRET) {
      logger.warn('⚠️  META_APP_SECRET not set - skipping webhook verification (DEVELOPMENT ONLY)');
      return next();
    }
    
    // Get signature from header
    const signature = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'];
    
    if (!signature) {
      logger.warn('Webhook request missing signature', {
        headers: req.headers,
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Missing signature'
      });
    }
    
    // Instagram sends the raw body, so we need to store it
    // This is handled by express.json() with verify option
    const rawBody = req.rawBody;
    
    if (!rawBody) {
      logger.error('Raw body not available for signature verification');
      return res.status(500).json({
        success: false,
        error: 'Cannot verify signature'
      });
    }
    
    // Extract hash from signature (format: sha256=<hash>)
    const signatureHash = signature.split('=')[1];
    
    // Calculate expected signature
    const expectedHash = crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(rawBody)
      .digest('hex');
    
    // Compare signatures (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signatureHash),
      Buffer.from(expectedHash)
    );
    
    if (!isValid) {
      logger.warn('❌ Invalid webhook signature', {
        ip: req.ip,
        signature: signatureHash.substring(0, 10) + '...',
        expected: expectedHash.substring(0, 10) + '...'
      });
      
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }
    
    logger.debug('✅ Webhook signature verified');
    next();
    
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    
    // In case of error, reject the webhook
    res.status(500).json({
      success: false,
      error: 'Signature verification failed'
    });
  }
};

/**
 * Middleware to capture raw body for signature verification
 * Must be used BEFORE express.json()
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Buffer} buf - Raw body buffer
 */
const captureRawBody = (req, res, buf) => {
  req.rawBody = buf.toString('utf8');
};

module.exports = {
  verifyWebhookSignature,
  captureRawBody
};