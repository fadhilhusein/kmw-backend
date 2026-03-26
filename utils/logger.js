/**
 * Advanced Logger Utility
 *
 * Comprehensive logging system using Winston with multiple transports,
 * log levels, and formats for different environments
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const loggingConfig = require('../config/logging');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom format for console output (development friendly)
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n  ${JSON.stringify(meta, null, 2).split('\n').join('\n  ')}`;
    }
    const contextStr = context ? ` [${context}]` : '';
    return `${timestamp} ${level}${contextStr}: ${message}${metaStr}`;
  })
);

/**
 * JSON format for file logging (production ready)
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Combined format (both JSON and console friendly)
 */
const combinedFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, context, error, ...meta }) => {
    const logObj = {
      timestamp,
      level,
      context: context || 'default',
      message
    };

    if (error) {
      logObj.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code
      };
    }

    if (Object.keys(meta).length > 0) {
      Object.assign(logObj, meta);
    }

    return JSON.stringify(logObj);
  })
);

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  levels: loggingConfig.LOG_LEVELS,
  level: loggingConfig.getEnvConfig().level,
  format: jsonFormat,
  defaultMeta: {
    service: 'kmw-backend',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file - only logs errors and above
    new DailyRotateFile({
      filename: loggingConfig.getLogPath('error'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: loggingConfig.getMaxFileRetention(),
      format: jsonFormat
    }),

    // Combined log file - logs everything
    new DailyRotateFile({
      filename: loggingConfig.getLogPath('combined'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: loggingConfig.getMaxFileRetention(),
      format: combinedFormat
    })
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: loggingConfig.getLogPath('exceptions'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: loggingConfig.getMaxFileRetention()
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: loggingConfig.getLogPath('rejection'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: loggingConfig.getMaxFileRetention()
    })
  ]
});

/**
 * Add console transport for development
 */
if (loggingConfig.isConsoleLoggingEnabled()) {
  const env = process.env.NODE_ENV || 'development';

  // Development: use console format
  if (env === 'development') {
    logger.add(new winston.transports.Console({
      format: consoleFormat,
      level: loggingConfig.getEnvConfig().level
    }));
  } else {
    // Production/Test: use combined format for console
    logger.add(new winston.transports.Console({
      format: combinedFormat,
      level: loggingConfig.getEnvConfig().level
    }));
  }
}

/**
 * Log with context - helper function for structured logging
 */
function logWithContext(level, message, context = 'default', meta = {}) {
  logger.log({
    level,
    message,
    context,
    ...meta
  });
}

/**
 * Enhanced logging methods with context support
 */
const enhancedLogger = {
  /**
   * Log error level message
   */
  error: (message, meta = {}, context = 'default') => {
    logWithContext('error', message, context, meta);
  },

  /**
   * Log warning level message
   */
  warn: (message, meta = {}, context = 'default') => {
    logWithContext('warn', message, context, meta);
  },

  /**
   * Log info level message
   */
  info: (message, meta = {}, context = 'default') => {
    logWithContext('info', message, context, meta);
  },

  /**
   * Log debug level message
   */
  debug: (message, meta = {}, context = 'default') => {
    logWithContext('debug', message, context, meta);
  },

  /**
   * Log trace level message (development only)
   */
  trace: (message, meta = {}, context = 'default') => {
    if (process.env.NODE_ENV === 'development') {
      logWithContext('trace', message, context, meta);
    }
  },

  /**
   * HTTP request logging helper
   */
  http: (req, res, responseTime) => {
    const meta = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      requestId: req.id
    };

    const level = res.statusCode >= 400 ? 'error' : 'info';
    logWithContext(level, 'HTTP Request', 'HTTP', meta);
  },

  /**
   * Database query logging helper
   */
  database: (query, duration, error = null) => {
    const meta = {
      query: query.substring(0, 200), // Truncate long queries
      duration: `${duration}ms`,
      model: query.model
    };

    const level = error ? 'error' : (duration > 1000 ? 'warn' : 'debug');
    const message = error ? `Database query failed: ${error.message}` : 'Database query executed';

    logWithContext(level, message, 'DATABASE', meta);
  },

  /**
   * Authentication logging helper
   */
  auth: (action, userId = null, success = true, meta = {}) => {
    const authMeta = {
      action,
      userId,
      success,
      timestamp: new Date().toISOString(),
      ...meta
    };

    const level = success ? 'info' : 'warn';
    logWithContext(level, `Auth action: ${action}`, 'AUTH', authMeta);
  },

  /**
   * API call logging helper
   */
  api: (endpoint, method, statusCode, responseTime, error = null) => {
    const apiMeta = {
      endpoint,
      method,
      statusCode,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    };

    const level = error ? 'error' : (statusCode >= 400 ? 'warn' : 'info');
    const message = error ? `API call failed: ${error.message}` : 'API call executed';

    logWithContext(level, message, 'API', apiMeta);
  },

  /**
   * System health logging helper
   */
  health: (component, status, meta = {}) => {
    const healthMeta = {
      component,
      status,
      timestamp: new Date().toISOString(),
      ...meta
    };

    const level = status === 'healthy' ? 'info' : (status === 'warning' ? 'warn' : 'error');
    logWithContext(level, `Health check: ${component}`, 'HEALTH', healthMeta);
  },

  /**
   * Background job logging helper
   */
  job: (jobName, status, duration = null, meta = {}) => {
    const jobMeta = {
      jobName,
      status,
      duration: duration ? `${duration}ms` : null,
      timestamp: new Date().toISOString(),
      ...meta
    };

    const level = status === 'completed' ? 'info' : (status === 'failed' ? 'error' : 'debug');
    const message = `Job ${jobName} ${status}`;

    logWithContext(level, message, 'JOB', jobMeta);
  }
};

/**
 * Export both the winston logger and enhanced logger
 */
module.exports = {
  logger,
  ...enhancedLogger,
  winston // Export winston for advanced usage if needed
};