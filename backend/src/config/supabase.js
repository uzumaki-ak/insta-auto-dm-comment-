/**
 * Supabase Client Configuration
 * Used for authentication (JWT verification)
 * Database is handled by PostgreSQL directly for better control
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Validate Supabase environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  logger.error('❌ Missing Supabase environment variables');
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

// Create Supabase client for authentication
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false // Server-side, don't persist sessions
    }
  }
);

// Create admin client (can bypass RLS policies)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Verify JWT token from frontend
 * @param {string} token - JWT token from Authorization header
 * @returns {Promise<Object>} - User object or null
 */
const verifyToken = async (token) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      logger.warn('Invalid token:', error.message);
      return null;
    }
    
    return user;
  } catch (error) {
    logger.error('Token verification error:', error);
    return null;
  }
};

/**
 * Check if Supabase connection is healthy
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    // Try to get current session
    const { data, error } = await supabase.auth.getSession();
    return !error;
  } catch (error) {
    logger.error('Supabase health check failed:', error);
    return false;
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  verifyToken,
  healthCheck
};