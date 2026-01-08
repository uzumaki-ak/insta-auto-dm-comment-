/**
 * PostgreSQL Database Configuration
 * Handles connection pooling and queries
 * Used for storing posts, keywords, and replied comments
 */

const { Pool } = require("pg");
const logger = require("../utils/logger");

// Create connection pool (handles multiple simultaneous queries)
// Pool is better than single client for high traffic (2000+ comments)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Maximum number of clients in the pool
  max: 20,
  // How long a client can be idle before being closed (30 seconds)
  idleTimeoutMillis: 30000,
  // How long to wait for a connection before timing out (2 seconds)
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on("connect", () => {
  logger.info("✅ PostgreSQL connected");
});

pool.on("error", (err) => {
  logger.error("❌ Unexpected PostgreSQL error:", err);
  process.exit(-1);
});

/**
 * Execute a SQL query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>100ms)
    if (duration > 100) {
      logger.warn(`Slow query detected (${duration}ms):`, {
        query: text,
        duration,
      });
    }

    return result;
  } catch (error) {
    logger.error("Database query error:", {
      query: text,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * Use this when you need to run multiple queries atomically
 * @returns {Promise<Object>} - Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;

  // Log when client is acquired/released
  logger.debug("Client acquired from pool");

  // Override release to add logging
  client.release = () => {
    logger.debug("Client released to pool");
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease.apply(client);
  };

  return client;
};

/**
 * Check if database connection is healthy
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    await query("SELECT NOW()");
    return true;
  } catch (error) {
    logger.error("Database health check failed:", error);
    return false;
  }
};

module.exports = {
  query,
  getClient,
  pool,
  healthCheck,
};
