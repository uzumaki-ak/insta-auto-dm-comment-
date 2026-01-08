/**
 * Authentication Middleware
 * Verifies JWT tokens from Supabase
 * Protects API routes from unauthorized access
 */

const { verifyToken } = require("../config/supabase");
const logger = require("../utils/logger");

/**
 * Authenticate user via JWT token
 * Expects: Authorization: Bearer <token>
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const authenticate = async (req, res, next) => {
  try {
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (req.method === "OPTIONS") {
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn("No authorization header provided", {
        path: req.path,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        error: "No authorization token provided",
      });
    }

    // Authorization header format: "Bearer <token>"
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Invalid authorization format",
      });
    }

    // Verify token with Supabase
    const user = await verifyToken(token);

    if (!user) {
      logger.warn("Invalid token provided", {
        path: req.path,
        ip: req.ip,
      });
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    // Attach user to request object for use in controllers
    req.user = user;

    logger.debug("User authenticated", {
      userId: user.id,
      email: user.email,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error("Authentication error:", {
      error: error.message,
      path: req.path,
    });

    res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

/**
 * Optional authentication
 * Similar to authenticate but doesn't block if no token
 * Useful for public endpoints that have extra features for logged-in users
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Skip for OPTIONS
    if (req.method === "OPTIONS") {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const user = await verifyToken(token);

      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Don't block request if optional auth fails
    logger.debug("Optional auth failed (non-blocking)", {
      error: error.message,
    });
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};
