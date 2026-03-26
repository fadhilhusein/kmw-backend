/**
 * Log Context Utility
 *
 * Utility for managing request context in logs
 * Provides request ID generation, context storage, and retrieval
 */

const crypto = require('crypto');

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate unique error ID for tracking
 */
function generateErrorId() {
  return `err_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Generate unique transaction ID
 */
function generateTransactionId() {
  return `tx_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Create request context object
 */
function createRequestContext(req) {
  return {
    requestId: req.id || generateRequestId(),
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    userAgent: req.get('user-agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || null,
    userRole: req.user?.role || null,
    headers: {
      contentType: req.get('content-type'),
      authorization: req.get('authorization') ? '***MASKED***' : null
    }
  };
}

/**
 * Create error context object
 */
function createErrorContext(error, req = null) {
  const errorContext = {
    errorId: generateErrorId(),
    timestamp: new Date().toISOString(),
    name: error.name || 'Error',
    message: error.message || 'Unknown error',
    code: error.code || null,
    stack: error.stack || null,
    status: error.status || error.statusCode || 500
  };

  // Add request context if available
  if (req) {
    errorContext.request = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      ip: req.ip,
      userId: req.user?.id || null
    };
  }

  // Add additional error properties
  if (error.details) {
    errorContext.details = error.details;
  }

  if (error.meta) {
    errorContext.meta = error.meta;
  }

  return errorContext;
}

/**
 * Create user context object
 */
function createUserContext(user) {
  return {
    userId: user.id,
    userRole: user.role,
    userName: user.name,
    email: user.email ? `${user.email.substring(0, 3)}***@***` : null,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create performance context object
 */
function createPerformanceContext(operation, duration, metadata = {}) {
  return {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    metadata
  };
}

/**
 * Create database context object
 */
function createDatabaseContext(query, duration, error = null) {
  const context = {
    queryType: query.model || 'unknown',
    operation: query.action || 'query',
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  };

  if (error) {
    context.error = {
      message: error.message,
      code: error.code
    };
  }

  return context;
}

/**
 * Create API context object
 */
function createAPIContext(endpoint, method, statusCode, responseTime, error = null) {
  const context = {
    endpoint,
    method,
    statusCode,
    responseTime: `${responseTime}ms`,
    timestamp: new Date().toISOString()
  };

  if (error) {
    context.error = {
      message: error.message,
      code: error.code
    };
  }

  return context;
}

/**
 * Middleware to attach request ID to request object
 */
function attachRequestId(req, res, next) {
  req.id = req.id || generateRequestId();
  next();
}

/**
 * Middleware to attach user context to request object
 */
function attachUserContext(req, res, next) {
  if (req.user) {
    req.userContext = createUserContext(req.user);
  } else {
    req.userContext = null;
  }
  next();
}

/**
 * Middleware to attach timing information
 */
function attachTiming(req, res, next) {
  req.startTime = Date.now();
  next();
}

/**
 * Calculate request duration
 */
function getRequestDuration(req) {
  if (req.startTime) {
    return Date.now() - req.startTime;
  }
  return 0;
}

/**
 * Get full request context for logging
 */
function getFullRequestContext(req) {
  const baseContext = createRequestContext(req);

  return {
    ...baseContext,
    userContext: req.userContext || null,
    duration: req.startTime ? getRequestDuration(req) : null
  };
}

/**
 * Create structured log message with context
 */
function createLogMessage(level, message, context, metadata = {}) {
  return {
    level,
    message,
    context,
    metadata,
    timestamp: new Date().toISOString()
  };
}

/**
 * Extract common context from multiple sources
 */
function extractContext(req, res, error = null) {
  const context = {
    requestId: req?.id || generateRequestId(),
    timestamp: new Date().toISOString()
  };

  if (req) {
    context.request = {
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
  }

  if (req?.user) {
    context.user = {
      id: req.user.id,
      role: req.user.role
    };
  }

  if (res) {
    context.response = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage
    };
  }

  if (error) {
    context.error = {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status || error.statusCode
    };
  }

  if (req?.startTime) {
    context.duration = `${getRequestDuration(req)}ms`;
  }

  return context;
}

module.exports = {
  generateRequestId,
  generateErrorId,
  generateTransactionId,
  createRequestContext,
  createErrorContext,
  createUserContext,
  createPerformanceContext,
  createDatabaseContext,
  createAPIContext,
  attachRequestId,
  attachUserContext,
  attachTiming,
  getRequestDuration,
  getFullRequestContext,
  createLogMessage,
  extractContext
};