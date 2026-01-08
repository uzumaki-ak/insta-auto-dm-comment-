/**
 * Instagram Service - All Instagram Graph API interactions
 * Handles API calls with retry logic, error handling, and rate limiting
 * This is the ONLY file that makes direct API calls to Instagram
 */

const { instagramApi, config } = require("../config/instagram");
const logger = require("../utils/logger");
const { retryWithBackoff } = require("../utils/retry");

// ============================================
// COMMENT OPERATIONS
// ============================================

/**
 * Get comment details from Instagram
 *
 * @param {string} commentId - Instagram comment ID
 * @returns {Promise<Object>} - Comment data
 */
const getCommentDetails = async (commentId) => {
  try {
    logger.debug("Fetching comment details", { commentId });

    const response = await retryWithBackoff(
      () =>
        instagramApi.get(`/${commentId}`, {
          params: {
            fields: "id,text,username,timestamp,user,from",
          },
        }),
      { maxRetries: 3 }
    );

    return response.data;
  } catch (error) {
    logger.error("Failed to get comment details:", {
      commentId,
      error: error.response?.data || error.message,
    });
    throw new Error(`Failed to fetch comment ${commentId}: ${error.message}`);
  }
};

/**
 * Reply to a comment on Instagram
 * This posts a public reply visible to everyone
 *
 * @param {string} commentId - Instagram comment ID to reply to
 * @param {string} message - Reply text
 * @returns {Promise<Object>} - Reply data with ID
 */
const replyToComment = async (commentId, message) => {
  try {
    logger.info("Replying to comment", { commentId, message });

    // Validate message length (Instagram limit is 2200 characters)
    if (!message || message.length === 0) {
      throw new Error("Reply message cannot be empty");
    }

    if (message.length > 2200) {
      logger.warn("Message too long, truncating", {
        originalLength: message.length,
      });
      message = message.substring(0, 2197) + "...";
    }

    const response = await retryWithBackoff(
      () =>
        instagramApi.post(`/${commentId}/replies`, {
          message: message,
        }),
      {
        maxRetries: 3,
        shouldRetry: (error) => {
          // Don't retry if comment was deleted or user blocked us
          const errorCode = error.response?.data?.error?.code;
          if (errorCode === 100 || errorCode === 200) {
            return false;
          }
          return true;
        },
      }
    );

    logger.info("✅ Reply posted successfully", {
      commentId,
      replyId: response.data.id,
    });

    return response.data;
  } catch (error) {
    const errorData = error.response?.data?.error;

    // Handle specific Instagram errors gracefully
    if (errorData?.code === 100) {
      logger.warn("Comment was deleted or user blocked us", { commentId });
      throw new Error("Comment no longer exists");
    }

    if (errorData?.code === 4) {
      logger.warn("Rate limit hit while replying", { commentId });
      throw new Error("Rate limit exceeded");
    }

    if (errorData?.code === 190) {
      logger.error("Access token expired or invalid");
      throw new Error("Authentication failed - token expired");
    }

    logger.error("Failed to reply to comment:", {
      commentId,
      error: errorData || error.message,
    });

    throw new Error(
      `Failed to reply to comment: ${errorData?.message || error.message}`
    );
  }
};

/**
 * Get all comments on a media (post/reel)
 * Used to fetch comments if we miss webhooks
 *
 * @param {string} mediaId - Instagram media ID
 * @param {number} limit - Max comments to fetch (default 100)
 * @returns {Promise<Array>} - Array of comments
 */
const getMediaComments = async (mediaId, limit = 100) => {
  try {
    logger.debug("Fetching media comments", { mediaId, limit });

    const response = await retryWithBackoff(
      () =>
        instagramApi.get(`/${mediaId}/comments`, {
          params: {
            fields: "id,text,username,timestamp,user,from",
            limit: Math.min(limit, 100), // Instagram max is 100 per request
          },
        }),
      { maxRetries: 3 }
    );

    return response.data.data || [];
  } catch (error) {
    logger.error("Failed to get media comments:", {
      mediaId,
      error: error.response?.data || error.message,
    });
    throw new Error(`Failed to fetch comments for media ${mediaId}`);
  }
};

// ============================================
// DIRECT MESSAGE OPERATIONS
// ============================================

/**
 * Send a direct message to a user
 * Can only DM users who have interacted with your content in last 24 hours
 *
 * @param {string} userId - Instagram user ID (IGID, not username)
 * @param {string} message - DM text
 * @returns {Promise<Object>} - Message data
 */
const sendDirectMessage = async (userId, message) => {
  try {
    logger.info("Sending DM", { userId, message });

    // Validate message
    if (!message || message.length === 0) {
      throw new Error("DM message cannot be empty");
    }

    if (message.length > 1000) {
      logger.warn("DM too long, truncating", {
        originalLength: message.length,
      });
      message = message.substring(0, 997) + "...";
    }

    // Instagram requires Business Account ID for DMs
    const businessAccountId = config.businessAccountId;

    const response = await retryWithBackoff(
      () =>
        instagramApi.post(`/${businessAccountId}/messages`, {
          recipient: {
            id: userId,
          },
          message: {
            text: message,
          },
        }),
      {
        maxRetries: 3,
        shouldRetry: (error) => {
          const errorCode = error.response?.data?.error?.code;
          // Don't retry if outside 24hr window or user blocked us
          if (errorCode === 10 || errorCode === 100 || errorCode === 200) {
            return false;
          }
          return true;
        },
      }
    );

    logger.info("✅ DM sent successfully", {
      userId,
      messageId: response.data.message_id,
    });

    return response.data;
  } catch (error) {
    const errorData = error.response?.data?.error;

    // Handle specific Instagram DM errors
    if (errorData?.code === 10) {
      logger.warn("Cannot DM user - outside 24hr window", { userId });
      throw new Error("DM window expired");
    }

    if (errorData?.code === 100 || errorData?.code === 200) {
      logger.warn("Cannot DM user - blocked or privacy settings", { userId });
      throw new Error("User cannot receive DMs");
    }

    if (errorData?.code === 551) {
      logger.warn("User does not follow you or has not interacted", { userId });
      throw new Error("User has not interacted with your content");
    }

    logger.error("Failed to send DM:", {
      userId,
      error: errorData || error.message,
    });

    throw new Error(
      `Failed to send DM: ${errorData?.message || error.message}`
    );
  }
};

// ============================================
// MEDIA OPERATIONS
// ============================================

/**
 * Get recent media (posts/reels) from Instagram account
 * Used to populate dashboard with posts
 *
 * @param {number} limit - Max posts to fetch (default 25)
 * @returns {Promise<Array>} - Array of media objects
 */
const getRecentMedia = async (limit = 25) => {
  try {
    logger.debug("Fetching recent media", { limit });

    const businessAccountId = config.businessAccountId;

    const response = await retryWithBackoff(
      () =>
        instagramApi.get(`/${businessAccountId}/media`, {
          params: {
            fields:
              "id,caption,media_type,media_url,permalink,timestamp,comments_count,like_count",
            limit: Math.min(limit, 100),
          },
        }),
      { maxRetries: 3 }
    );

    logger.info("✅ Fetched recent media", {
      count: response.data.data?.length || 0,
    });

    return response.data.data || [];
  } catch (error) {
    logger.error("Failed to get recent media:", {
      error: error.response?.data || error.message,
    });
    throw new Error("Failed to fetch Instagram media");
  }
};

/**
 * Get specific media details
 *
 * @param {string} mediaId - Instagram media ID
 * @returns {Promise<Object>} - Media details
 */
const getMediaDetails = async (mediaId) => {
  try {
    logger.debug("Fetching media details", { mediaId });

    const response = await retryWithBackoff(
      () =>
        instagramApi.get(`/${mediaId}`, {
          params: {
            fields:
              "id,caption,media_type,media_url,permalink,timestamp,comments_count,like_count",
          },
        }),
      { maxRetries: 3 }
    );

    return response.data;
  } catch (error) {
    logger.error("Failed to get media details:", {
      mediaId,
      error: error.response?.data || error.message,
    });
    throw new Error(`Failed to fetch media ${mediaId}`);
  }
};

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Verify Instagram API access token is valid
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    const businessAccountId = config.businessAccountId;

    // Simple API call to verify token
    await instagramApi.get(`/${businessAccountId}`, {
      params: {
        fields: "id,username",
      },
    });

    logger.debug("Instagram API health check passed");
    return true;
  } catch (error) {
    logger.error("Instagram API health check failed:", {
      error: error.response?.data || error.message,
    });
    return false;
  }
};

// ============================================
// WEBHOOK VALIDATION
// ============================================

/**
 * Validate webhook signature from Instagram
 * This ensures webhook requests are actually from Instagram
 *
 * @param {string} signature - X-Hub-Signature header value
 * @param {string} body - Raw request body
 * @returns {boolean} - True if valid
 */
const validateWebhookSignature = (signature, body) => {
  const crypto = require("crypto");

  if (!process.env.META_APP_SECRET) {
    logger.warn("META_APP_SECRET not set, skipping signature validation");
    return true; // Allow in development
  }

  if (!signature) {
    logger.warn("No signature provided in webhook request");
    return false;
  }

  try {
    // Instagram sends signature as sha256=<hash>
    const signatureHash = signature.split("sha256=")[1];

    // Calculate expected signature
    const expectedHash = crypto
      .createHmac("sha256", process.env.META_APP_SECRET)
      .update(body)
      .digest("hex");

    const isValid = signatureHash === expectedHash;

    if (!isValid) {
      logger.warn("Invalid webhook signature");
    }

    return isValid;
  } catch (error) {
    logger.error("Error validating webhook signature:", error);
    return false;
  }
};

module.exports = {
  // Comment operations
  getCommentDetails,
  replyToComment,
  getMediaComments,

  // DM operations
  sendDirectMessage,

  // Media operations
  getRecentMedia,
  getMediaDetails,

  // Utilities
  validateWebhookSignature,
  healthCheck,
};
