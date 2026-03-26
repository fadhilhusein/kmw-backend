/**
 * Request Logger Middleware
 *
 * Middleware for logging HTTP requests and responses
 * Tracks request timing, status codes, and performance metrics
 */

const logger = require('../utils/logger');
const logContext = require('../utils/logContext');
const sensitiveDataMasker = require('../utils/sensitiveDataMasker');

/**
 * Request logging middleware
 * Logs incoming requests and their responses with timing information
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  req.startTime = startTime;

  // Generate request ID if not already present
  if (!req.id) {
    req.id = logContext.generateRequestId();
  }

  // Log incoming request
  logger.http(req, res, 0);

  // Capture the original res.json to log responses
  const originalJson = res.json;

  // Override res.json to log response data
  res.json = function(data) {
    res.responseData = data;
    return originalJson.call(this, data);
  };

  // Listen for response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log the completed request with response details
    logger.http(req, res, duration);

    // Additional logging for errors
    if (res.statusCode >= 400) {
      logger.warn(`Request failed with status ${res.statusCode}`, {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.id,
        responseBody: res.responseData ? sensitiveDataMasker.maskSensitiveData(res.responseData) : null
      }, 'REQUEST');
    }
  });

  next();
}

/**
 * Detailed request logging middleware
 * Logs detailed request information including headers and body
 */
function detailedRequestLogger(req, res, next) {
  const startTime = Date.now();
  req.startTime = startTime;

  // Generate request ID if not already present
  if (!req.id) {
    req.id = logContext.generateRequestId();
  }

  // Log detailed request information
  logger.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: sensitiveDataMasker.maskSensitiveData(req.query),
    body: sensitiveDataMasker.maskSensitiveData(req.body),
    headers: sensitiveDataMasker.maskSensitiveData(req.headers),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    timestamp: new Date().toISOString()
  }, 'REQUEST');

  // Listen for response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log detailed response information
    logger.info('Response sent', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: `${duration}ms`,
      responseBody: res.responseData ? sensitiveDataMasker.maskSensitiveData(res.responseData) : null,
      timestamp: new Date().toISOString()
    }, 'RESPONSE');

    // Performance logging
    if (duration > 1000) {
      logger.warn(`Slow request detected (${duration}ms)`, {
        method: req.method,
        url: req.originalUrl || req.url,
        duration: `${duration}ms`,
        requestId: req.id
      }, 'PERFORMANCE');
    } else if (duration > 500) {
      logger.info(`Request took ${duration}ms`, {
        method: req.method,
        url: req.originalUrl || req.url,
        duration: `${duration}ms`,
        requestId: req.id
      }, 'PERFORMANCE');
    }
  });

  next();
}

/**
 * Response logging middleware
 * Only logs response information (useful for specific routes)
 */
function responseLogger(req, res, next) {
  const startTime = Date.now();
  req.startTime = startTime;

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.api(
      req.originalUrl || req.url,
      req.method,
      res.statusCode,
      duration,
      null // No error
    );
  });

  next();
}

/**
 * Error response logging middleware
 * Logs error responses with additional context
 */
function errorResponseLogger(req, res, next) {
  const startTime = Date.now();
  req.startTime = startTime;

  res.on('finish', () => {
    if (res.statusCode >= 400) {
      const duration = Date.now() - startTime;

      logger.error(`Error response: ${res.statusCode}`, {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        duration: `${duration}ms`,
        requestId: req.id,
        responseBody: res.responseData ? sensitiveDataMasker.maskSensitiveData(res.responseData) : null
      }, 'ERROR_RESPONSE');
    }
  });

  next();
}

/**
 * Request timing middleware
 * Attaches timing information to request object for other middleware
 */
function attachTiming(req, res, next) {
  req.startTime = Date.now();

  // Add timing to response headers for debugging
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });

  next();
}

/**
 * Request context middleware
 * Attaches full request context to request object
 */
function attachRequestContext(req, res, next) {
  req.context = logContext.getFullRequestContext(req);
  next();
}

/**
 * Conditional request logger
 * Only logs requests that meet certain criteria
 */
function conditionalRequestLogger(options = {}) {
  const {
    includePaths = [],
    excludePaths = [],
    includeMethods = [],
    excludeMethods = [],
    minDuration = 0,
    logErrorsOnly = false
  } = options;

  return (req, res, next) => {
    const startTime = Date.now();
    req.startTime = startTime;

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      // Check if we should log this request
      let shouldLog = true;

      // Check path filters
      if (includePaths.length > 0 && !includePaths.some(path => req.path.includes(path))) {
        shouldLog = false;
      }
      if (excludePaths.length > 0 && excludePaths.some(path => req.path.includes(path))) {
        shouldLog = false;
      }

      // Check method filters
      if (includeMethods.length > 0 && !includeMethods.includes(req.method)) {
        shouldLog = false;
      }
      if (excludeMethods.length > 0 && excludeMethods.includes(req.method)) {
        shouldLog = false;
      }

      // Check duration filter
      if (minDuration > 0 && duration < minDuration) {
        shouldLog = false;
      }

      // Check errors only filter
      if (logErrorsOnly && res.statusCode < 400) {
        shouldLog = false;
      }

      // Log if criteria met
      if (shouldLog) {
        logger.http(req, res, duration);
      }
    });

    next();
  };
}

/**
 * Create request ID middleware
 * Attaches unique request ID to every request
 */
function createRequestId(req, res, next) {
  req.id = logContext.generateRequestId();
  res.setHeader('X-Request-ID', req.id);
  next();
}

/**
 * Performance logging middleware
 * Logs performance metrics for requests
 */
function performanceLogger(req, res, next) {
  const startTime = Date.now();
  req.startTime = startTime;

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log performance data
    logger.info('Request performance', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString()
    }, 'PERFORMANCE');

    // Alert on slow requests
    if (duration > 3000) {
      logger.warn('Very slow request detected', {
        method: req.method,
        url: req.originalUrl || req.url,
        duration: `${duration}ms`,
        requestId: req.id
      }, 'PERFORMANCE');
    }
  });

  next();
}

module.exports = {
  requestLogger,
  detailedRequestLogger,
  responseLogger,
  errorResponseLogger,
  attachTiming,
  attachRequestContext,
  conditionalRequestLogger,
  createRequestId,
  performanceLogger
};