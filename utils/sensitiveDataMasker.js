/**
 * Sensitive Data Masker
 *
 * Utility to mask sensitive information in logs
 * Prevents passwords, tokens, and other sensitive data from being logged
 */

const loggingConfig = require('../config/logging');

/**
 * Mask sensitive data from an object or string
 */
function maskSensitiveData(data) {
  if (typeof data === 'string') {
    return maskString(data);
  }

  if (typeof data === 'object' && data !== null) {
    return maskObject(data);
  }

  // Return as-is if it's a number, boolean, etc.
  return data;
}

/**
 * Mask sensitive data from a string
 */
function maskString(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let masked = str;
  const patterns = loggingConfig.getSensitivePatterns();

  patterns.forEach(pattern => {
    masked = masked.replace(pattern.pattern, pattern.replacement);
  });

  return masked;
}

/**
 * Mask sensitive data from an object (recursive)
 */
function maskObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Prevent infinite recursion with depth limit
  if (depth > 10) {
    return obj;
  }

  const masked = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      // Check if key should be masked
      if (isSensitiveKey(key)) {
        masked[key] = '***MASKED***';
      }
      // Check if value is sensitive data in string
      else if (typeof value === 'string' && containsSensitiveData(value)) {
        masked[key] = maskString(value);
      }
      // Recursively mask nested objects
      else if (typeof value === 'object' && value !== null) {
        masked[key] = maskObject(value, depth + 1);
      }
      else {
        masked[key] = value;
      }
    }
  }

  return masked;
}

/**
 * Check if a key should be masked
 */
function isSensitiveKey(key) {
  const sensitiveKeys = [
    'password',
    'pwd',
    'pass',
    'secret',
    'token',
    'authorization',
    'auth',
    'apikey',
    'api_key',
    'api-key',
    'accessToken',
    'access_token',
    'access-token',
    'refreshToken',
    'refresh_token',
    'refresh-token',
    'sessionId',
    'session_id',
    'session-id',
    'creditCard',
    'credit_card',
    'credit-card',
    'ccNumber',
    'cc_number',
    'ssn',
    'socialSecurity',
    'bankAccount',
    'bank_account',
    'pin'
  ];

  const lowerKey = key.toLowerCase();
  return sensitiveKeys.some(sensitiveKey =>
    lowerKey.includes(sensitiveKey.toLowerCase()) ||
    lowerKey === sensitiveKey.toLowerCase()
  );
}

/**
 * Check if a string contains sensitive data
 */
function containsSensitiveData(str) {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const patterns = loggingConfig.getSensitivePatterns();
  return patterns.some(pattern => pattern.pattern.test(str));
}

/**
 * Create a safe version of request object for logging
 */
function safeRequest(req) {
  if (!req) {
    return {};
  }

  return {
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: maskSensitiveData(req.query),
    body: maskSensitiveData(req.body),
    headers: maskSensitiveData(req.headers),
    ip: req.ip,
    requestId: req.id,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a safe version of response object for logging
 */
function safeResponse(res) {
  if (!res) {
    return {};
  }

  return {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a safe version of user object for logging
 */
function safeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email ? maskEmail(user.email) : null,
    role: user.role,
    createdAt: user.createdAt,
    // All other fields automatically masked
    ...maskSensitiveData(user)
  };
}

/**
 * Mask email address (show first 2 chars and domain)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return email;
  }

  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  const visibleChars = Math.min(2, localPart.length);
  const maskedPart = localPart.substring(0, visibleChars) + '***';

  return `${maskedPart}@${domain}`;
}

/**
 * Mask credit card number (show only last 4 digits)
 */
function maskCreditCard(cardNumber) {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return cardNumber;
  }

  const cleaned = cardNumber.replace(/\s/g, '');

  if (cleaned.length < 4) {
    return cardNumber;
  }

  const lastFour = cleaned.substring(cleaned.length - 4);
  return `****-****-****-${lastFour}`;
}

/**
 * Mask phone number (show only last 3 digits)
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return phoneNumber;
  }

  const cleaned = phoneNumber.replace(/[^0-9]/g, '');

  if (cleaned.length < 3) {
    return phoneNumber;
  }

  const lastThree = cleaned.substring(cleaned.length - 3);
  return `***-***-${lastThree}`;
}

module.exports = {
  maskSensitiveData,
  maskString,
  maskObject,
  isSensitiveKey,
  containsSensitiveData,
  safeRequest,
  safeResponse,
  safeUser,
  maskEmail,
  maskCreditCard,
  maskPhoneNumber
};