/**
 * Logging Configuration
 *
 * Configuration file for advanced logging system using Winston
 * Defines log levels, formats, and transports for different environments
 */

const path = require('path');

/**
 * Log Levels Configuration
 * error: 0 - Error events
 * warn: 1 - Warning events
 * info: 2 - Informational events
 * debug: 3 - Debugging messages
 * trace: 4 - Detailed tracing (development only)
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

/**
 * Environment-specific configuration
 */
const ENV_CONFIG = {
  development: {
    level: 'debug',
    format: 'combined', // Both JSON and console friendly
    console: true,
    file: true,
    maxFiles: '7d' // Keep logs for 7 days in development
  },
  production: {
    level: 'info',
    format: 'json', // JSON format for production
    console: true, // Still console for Heroku/cloud logs
    file: true,
    maxFiles: '30d' // Keep logs for 30 days in production
  },
  test: {
    level: 'error', // Only errors in tests
    format: 'json',
    console: true,
    file: false, // No file logging in tests
    maxFiles: '1d'
  }
};

/**
 * Log file paths
 */
const LOG_PATHS = {
  error: path.join(process.cwd(), 'logs', 'error.log'),
  combined: path.join(process.cwd(), 'logs', 'combined.log'),
  exceptions: path.join(process.cwd(), 'logs', 'exceptions.log'),
  rejection: path.join(process.cwd(), 'logs', 'rejections.log')
};

/**
 * Log format configuration
 */
const LOG_FORMATS = {
  /**
   * JSON format - suitable for production and log aggregation services
   */
  json: {
    format: 'json',
    timestamp: true,
    colorize: false,
    prettyPrint: false
  },

  /**
   * Combined format - both JSON and console friendly
   */
  combined: {
    format: 'combined', // Will use both formats
    timestamp: true,
    colorize: true,
    prettyPrint: true
  },

  /**
   * Console format - human readable for development
   */
  console: {
    format: 'simple',
    timestamp: true,
    colorize: true,
    prettyPrint: true
  }
};

/**
 * Log message format template
 */
const LOG_MESSAGE_TEMPLATE = {
  timestamp: 'YYYY-MM-DD HH:mm:ss',
  level: true,
  message: true,
  context: false,
  error: false,
  meta: false
};

/**
 * Sensitive data patterns to mask in logs
 */
const SENSITIVE_PATTERNS = [
  {
    name: 'password',
    pattern: /password["\s:=]+["']?([^"'\s,}]+)/gi,
    replacement: 'password=***MASKED***'
  },
  {
    name: 'token',
    pattern: /token["\s:=]+["']?([^"'\s,}]{20,})/gi,
    replacement: 'token=***MASKED***'
  },
  {
    name: 'secret',
    pattern: /secret["\s:=]+["']?([^"'\s,}]{10,})/gi,
    replacement: 'secret=***MASKED***'
  },
  {
    name: 'authorization',
    pattern: /authorization["\s:=]+["']?([^"'\s,}]{20,})/gi,
    replacement: 'authorization=***MASKED***'
  },
  {
    name: 'apiKey',
    pattern: /api[_-]?key["\s:=]+["']?([^"'\s,}]{20,})/gi,
    replacement: 'apiKey=***MASKED***'
  }
];

/**
 * Get current environment configuration
 */
function getEnvConfig() {
  const env = process.env.NODE_ENV || 'development';
  return ENV_CONFIG[env] || ENV_CONFIG.development;
}

/**
 * Get log file path for specific type
 */
function getLogPath(type) {
  return LOG_PATHS[type] || LOG_PATHS.combined;
}

/**
 * Check if logging to file is enabled
 */
function isFileLoggingEnabled() {
  const config = getEnvConfig();
  return config.file !== false;
}

/**
 * Check if console logging is enabled
 */
function isConsoleLoggingEnabled() {
  const config = getEnvConfig();
  return config.console !== false;
}

/**
 * Get maximum log retention period
 */
function getMaxFileRetention() {
  const config = getEnvConfig();
  return config.maxFiles || '7d';
}

/**
 * Get format configuration for specific environment
 */
function getFormatConfig() {
  const env = process.env.NODE_ENV || 'development';
  return LOG_FORMATS[ENV_CONFIG[env].format] || LOG_FORMATS.json;
}

/**
 * Get sensitive data patterns
 */
function getSensitivePatterns() {
  return SENSITIVE_PATTERNS;
}

module.exports = {
  LOG_LEVELS,
  ENV_CONFIG,
  LOG_PATHS,
  LOG_FORMATS,
  SENSITIVE_PATTERNS,
  getEnvConfig,
  getLogPath,
  isFileLoggingEnabled,
  isConsoleLoggingEnabled,
  getMaxFileRetention,
  getFormatConfig,
  getSensitivePatterns
};