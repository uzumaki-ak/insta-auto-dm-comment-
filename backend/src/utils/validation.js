/**
 * Validation Utility
 * Input validation helpers
 * Prevents bad data from entering the system
 */

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate URL format
 * @param {string} url
 * @returns {boolean}
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate UUID format
 * @param {string} uuid
 * @returns {boolean}
 */
const isValidUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Sanitize string (remove potentially dangerous characters)
 * @param {string} str
 * @returns {string}
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
};

/**
 * Validate keyword
 * Keywords must be 1-255 characters, no special control characters
 * @param {string} keyword
 * @returns {Object} { valid: boolean, error?: string }
 */
const validateKeyword = (keyword) => {
  if (!keyword || typeof keyword !== 'string') {
    return { valid: false, error: 'Keyword must be a non-empty string' };
  }
  
  if (keyword.length < 1 || keyword.length > 255) {
    return { valid: false, error: 'Keyword must be 1-255 characters' };
  }
  
  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(keyword)) {
    return { valid: false, error: 'Keyword contains invalid characters' };
  }
  
  return { valid: true };
};

/**
 * Validate reply message
 * Max 2200 characters (Instagram limit)
 * @param {string} message
 * @returns {Object}
 */
const validateReplyMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message must be a non-empty string' };
  }
  
  if (message.length > 2200) {
    return { valid: false, error: 'Message too long (max 2200 characters)' };
  }
  
  return { valid: true };
};

/**
 * Validate DM message
 * Max 1000 characters (Instagram limit)
 * @param {string} message
 * @returns {Object}
 */
const validateDmMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message must be a non-empty string' };
  }
  
  if (message.length > 1000) {
    return { valid: false, error: 'DM too long (max 1000 characters)' };
  }
  
  return { valid: true };
};

/**
 * Validate Instagram media ID
 * Format: numeric string, usually 17-19 digits
 * @param {string} mediaId
 * @returns {boolean}
 */
const isValidMediaId = (mediaId) => {
  return /^\d{10,20}$/.test(mediaId);
};

/**
 * Validate pagination parameters
 * @param {Object} params
 * @returns {Object} { limit, offset }
 */
const validatePagination = (params = {}) => {
  let { limit = 50, offset = 0 } = params;
  
  // Ensure they're numbers
  limit = parseInt(limit);
  offset = parseInt(offset);
  
  // Validate ranges
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 100) limit = 100; // Max 100 results
  
  if (isNaN(offset) || offset < 0) offset = 0;
  
  return { limit, offset };
};

/**
 * Validate required fields in object
 * @param {Object} obj - Object to validate
 * @param {Array<string>} requiredFields - Required field names
 * @returns {Object} { valid: boolean, missingFields?: Array }
 */
const validateRequiredFields = (obj, requiredFields) => {
  const missingFields = requiredFields.filter(field => {
    return !obj.hasOwnProperty(field) || obj[field] === null || obj[field] === undefined;
  });
  
  if (missingFields.length > 0) {
    return {
      valid: false,
      missingFields,
      error: `Missing required fields: ${missingFields.join(', ')}`
    };
  }
  
  return { valid: true };
};

module.exports = {
  isValidEmail,
  isValidUrl,
  isValidUuid,
  sanitizeString,
  validateKeyword,
  validateReplyMessage,
  validateDmMessage,
  isValidMediaId,
  validatePagination,
  validateRequiredFields
};