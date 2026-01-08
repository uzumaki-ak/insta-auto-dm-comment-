/**
 * Webhook Routes
 * Handles Instagram webhook verification and events
 * 
 * Instagram webhooks:
 * GET /webhook - Verification (one-time during setup)
 * POST /webhook - Receive events (comments, mentions, etc.)
 */

const express = require('express');
const router = express.Router();
const { verifyWebhook, handleWebhook } = require('../controllers/webhook.controller');
const { verifyWebhookSignature, captureRawBody } = require('../middleware/webhook.verify');

// ============================================
// WEBHOOK VERIFICATION (GET)
// ============================================

/**
 * GET /webhook
 * Instagram calls this to verify webhook subscription
 * Must respond with challenge parameter
 */
router.get('/', verifyWebhook);

// ============================================
// WEBHOOK EVENTS (POST)
// ============================================

/**
 * POST /webhook
 * Instagram sends comment events here
 * Must respond quickly (<5 seconds)
 * 
 * Middleware:
 * 1. Capture raw body (for signature verification)
 * 2. Verify signature (ensure it's from Instagram)
 * 3. Handle webhook event
 */
router.post(
  '/',
  express.json({ verify: captureRawBody }), // Capture raw body for signature
  verifyWebhookSignature, // Verify it's from Instagram
  handleWebhook // Process the event
);

module.exports = router;