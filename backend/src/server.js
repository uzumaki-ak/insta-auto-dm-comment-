// server.js - Replace the CORS middleware section
/**
 * Main Express Server (UPDATED)
 * Now includes queue worker
 */

require("dotenv").config();
const express = require("express");

const logger = require("./utils/logger");
const { errorHandler } = require("./middleware/errorHandler");
const { startQueueWorker } = require("./workers/queue.worker");

// Load environment variables

// Import routes
const webhookRoutes = require("./routes/webhook.routes");
const postsRoutes = require("./routes/posts.routes");
const statsRoutes = require("./routes/stats.routes");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Parse JSON bodies (for API requests)
app.use(express.json());

// CORS - Allow frontend to make requests
app.use((req, res, next) => {
  const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:5173"];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });
  next();
});

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Instagram webhook (NO AUTH - Instagram calls this)
app.use("/webhook", webhookRoutes);

// Protected API routes (require authentication)
app.use("/api/posts", postsRoutes);
app.use("/api/stats", statsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler (MUST be last)
app.use(errorHandler);

// ============================================
// START QUEUE WORKER
// ============================================

// Start the Bull queue worker
// This processes comments in the background
startQueueWorker();

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);

  // Warn if critical env vars are missing
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) {
    logger.warn("⚠️  INSTAGRAM_ACCESS_TOKEN not set!");
  }
  if (!process.env.DATABASE_URL) {
    logger.warn("⚠️  DATABASE_URL not set!");
  }
  if (!process.env.REDIS_URL) {
    logger.warn("⚠️  REDIS_URL not set - using default localhost:6379");
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
