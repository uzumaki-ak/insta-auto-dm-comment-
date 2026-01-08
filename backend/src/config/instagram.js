/**
 * Instagram Graph API Configuration
 * Contains endpoints and authentication for Meta's API
 */

const axios = require("axios");
const logger = require("../utils/logger");
require('dotenv').config();
// Instagram Graph API base URL
const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

// Validate required environment variables
const requiredEnvVars = [
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_BUSINESS_ACCOUNT_ID",
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    logger.error(`❌ Missing required environment variable: ${varName}`);
    throw new Error(`Missing ${varName} in environment variables`);
  }
});

// Configuration object
const config = {
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
  apiVersion: "v18.0",
  baseUrl: GRAPH_API_BASE,

  // API endpoints (following Instagram Graph API documentation)
  endpoints: {
    // Get recent media (posts/reels)
    getMedia: (userId) => `${GRAPH_API_BASE}/${userId}/media`,

    // Get comments on a specific media
    getComments: (mediaId) => `${GRAPH_API_BASE}/${mediaId}/comments`,

    // Reply to a comment
    replyToComment: (commentId) => `${GRAPH_API_BASE}/${commentId}/replies`,

    // Send direct message
    sendMessage: (userId) => `${GRAPH_API_BASE}/${userId}/messages`,

    // Get comment details
    getCommentDetails: (commentId) => `${GRAPH_API_BASE}/${commentId}`,
  },

  // Rate limiting configuration
  rateLimit: {
    maxRequestsPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR) || 180,
    retryAfterMs: 60000, // Wait 1 minute if rate limited
  },
};

/**
 * Create axios instance with default config for Instagram API
 * All Instagram API requests should use this instance
 */
const instagramApi = axios.create({
  baseURL: GRAPH_API_BASE,
  timeout: 10000, // 10 second timeout
  params: {
    access_token: config.accessToken,
  },
});

// Add request interceptor for logging
instagramApi.interceptors.request.use(
  (config) => {
    logger.debug("Instagram API Request:", {
      method: config.method,
      url: config.url,
      params: { ...config.params, access_token: "[REDACTED]" },
    });
    return config;
  },
  (error) => {
    logger.error("Instagram API Request Error:", error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
instagramApi.interceptors.response.use(
  (response) => {
    logger.debug("Instagram API Response:", {
      status: response.status,
      url: response.config.url,
    });
    return response;
  },
  (error) => {
    // Handle rate limiting (HTTP 429 or error code 4)
    if (
      error.response?.status === 429 ||
      error.response?.data?.error?.code === 4
    ) {
      logger.warn("⚠️  Instagram API rate limit hit");
    }

    // Handle OAuth errors (expired token)
    if (
      error.response?.status === 401 ||
      error.response?.data?.error?.code === 190
    ) {
      logger.error("❌ Instagram access token expired or invalid");
    }

    logger.error("Instagram API Error:", {
      status: error.response?.status,
      error: error.response?.data?.error || error.message,
    });

    return Promise.reject(error);
  }
);

module.exports = {
  config,
  instagramApi,
};
