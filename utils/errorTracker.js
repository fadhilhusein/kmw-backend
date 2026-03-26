/**
 * Error Tracker
 *
 * Advanced error tracking and aggregation system
 * Tracks error rates, types, and patterns for monitoring and analysis
 */

const logger = require('./logger');
const logContext = require('./logContext');

/**
 * In-memory error store (for development/small deployments)
 * In production, this should be replaced with database/external service
 */
const errorStore = {
  errors: [],
  errorCounts: {}, // Error type counts
  endpointErrors: {}, // Errors per endpoint
  recentErrors: [], // Last 100 errors
  stats: {
    totalErrors: 0,
    errorsToday: 0,
    errorsHour: 0,
    lastErrorTime: null
  }
};

/**
 * Track an error
 */
function trackError(error, req = null, additionalContext = {}) {
  const errorId = logContext.generateErrorId();
  const timestamp = new Date();

  // Create error object
  const errorObj = {
    id: errorId,
    timestamp: timestamp.toISOString(),
    name: error.name || 'Error',
    message: error.message || 'Unknown error',
    code: error.code || null,
    status: error.status || error.statusCode || 500,
    stack: error.stack || null,
    request: req ? {
      id: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    } : null,
    user: req?.user ? {
      id: req.user.id,
      role: req.user.role
    } : null,
    context: additionalContext
  };

  // Store error
  errorStore.errors.push(errorObj);
  errorStore.recentErrors.push(errorObj);

  // Limit recent errors to last 100
  if (errorStore.recentErrors.length > 100) {
    errorStore.recentErrors.shift();
  }

  // Update error counts
  const errorType = `${error.name}:${error.status}`;
  errorStore.errorCounts[errorType] = (errorStore.errorCounts[errorType] || 0) + 1;

  // Update endpoint errors
  if (req) {
    const endpoint = `${req.method}:${req.path}`;
    errorStore.endpointErrors[endpoint] = (errorStore.endpointErrors[endpoint] || 0) + 1;
  }

  // Update statistics
  errorStore.stats.totalErrors++;
  errorStore.stats.lastErrorTime = timestamp.toISOString();

  // Check if error happened today
  const today = new Date().toDateString();
  const errorDate = new Date(timestamp).toDateString();
  if (today === errorDate) {
    errorStore.stats.errorsToday++;
  }

  // Check if error happened this hour
  const currentHour = Math.floor(Date.now() / 3600000);
  const errorHour = Math.floor(timestamp.getTime() / 3600000);
  if (currentHour === errorHour) {
    errorStore.stats.errorsHour++;
  }

  // Log error
  logger.error(`Error tracked: ${error.message}`, {
    errorId,
    errorType,
    ...additionalContext
  }, 'ERROR_TRACKER');

  return errorId;
}

/**
 * Get error statistics
 */
function getErrorStats() {
  return {
    total: errorStore.stats.totalErrors,
    today: errorStore.stats.errorsToday,
    hour: errorStore.stats.errorsHour,
    lastError: errorStore.stats.lastErrorTime,
    byType: errorStore.errorCounts,
    byEndpoint: errorStore.endpointErrors,
    recentCount: errorStore.recentErrors.length
  };
}

/**
 * Get recent errors
 */
function getRecentErrors(limit = 10) {
  return errorStore.recentErrors
    .slice(-limit)
    .reverse(); // Most recent first
}

/**
 * Get errors by type
 */
function getErrorsByType(errorType, limit = 10) {
  return errorStore.errors
    .filter(err => `${err.name}:${err.status}` === errorType)
    .slice(-limit)
    .reverse();
}

/**
 * Get errors by endpoint
 */
function getErrorsByEndpoint(method, path, limit = 10) {
  const endpoint = `${method}:${path}`;
  return errorStore.errors
    .filter(err => err.request && `${err.request.method}:${err.request.path}` === endpoint)
    .slice(-limit)
    .reverse();
}

/**
 * Get errors by user
 */
function getErrorsByUser(userId, limit = 10) {
  return errorStore.errors
    .filter(err => err.user && err.user.id === userId)
    .slice(-limit)
    .reverse();
}

/**
 * Get error summary for dashboard
 */
function getErrorSummary() {
  const stats = getErrorStats();
  const recentErrors = getRecentErrors(5);

  // Calculate error rate (errors per hour for last 24h)
  const errorsLast24h = errorStore.errors.filter(err => {
    const errorTime = new Date(err.timestamp).getTime();
    const dayAgo = Date.now() - 86400000; // 24 hours ago
    return errorTime > dayAgo;
  }).length;

  const errorRatePerHour = (errorsLast24h / 24).toFixed(2);

  // Identify top error types
  const topErrorTypes = Object.entries(stats.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  // Identify top error endpoints
  const topErrorEndpoints = Object.entries(stats.byEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endpoint, count]) => ({ endpoint, count }));

  return {
    overview: {
      totalErrors: stats.total,
      errorsToday: stats.today,
      errorsHour: stats.hour,
      errorRatePerHour: parseFloat(errorRatePerHour),
      lastErrorTime: stats.lastError
    },
    topErrorTypes,
    topErrorEndpoints,
    recentErrors: recentErrors.map(err => ({
      id: err.id,
      name: err.name,
      message: err.message,
      status: err.status,
      timestamp: err.timestamp
    }))
  };
}

/**
 * Clear error store (useful for testing or manual reset)
 */
function clearErrorStore() {
  errorStore.errors = [];
  errorStore.errorCounts = {};
  errorStore.endpointErrors = {};
  errorStore.recentErrors = [];
  errorStore.stats = {
    totalErrors: 0,
    errorsToday: 0,
    errorsHour: 0,
    lastErrorTime: null
  };

  logger.info('Error store cleared', {}, 'ERROR_TRACKER');
}

/**
 * Check if error rate is high (alerting)
 */
function checkErrorRate() {
  const stats = getErrorStats();

  // Thresholds
  const thresholds = {
    critical: 100, // 100+ errors per hour
    high: 50,      // 50+ errors per hour
    moderate: 20   // 20+ errors per hour
  };

  const hourlyRate = stats.hour;

  if (hourlyRate >= thresholds.critical) {
    return {
      level: 'critical',
      message: `Critical error rate: ${hourlyRate} errors per hour`,
      rate: hourlyRate
    };
  } else if (hourlyRate >= thresholds.high) {
    return {
      level: 'high',
      message: `High error rate: ${hourlyRate} errors per hour`,
      rate: hourlyRate
    };
  } else if (hourlyRate >= thresholds.moderate) {
    return {
      level: 'moderate',
      message: `Moderate error rate: ${hourlyRate} errors per hour`,
      rate: hourlyRate
    };
  }

  return {
    level: 'normal',
    message: 'Normal error rate',
    rate: hourlyRate
  };
}

/**
 * Get error distribution by status code
 */
function getErrorDistributionByStatus() {
  const distribution = {};

  errorStore.errors.forEach(err => {
    const status = err.status || 500;
    distribution[status] = (distribution[status] || 0) + 1;
  });

  return distribution;
}

/**
 * Get error distribution by hour (last 24 hours)
 */
function getErrorDistributionByHour() {
  const distribution = {};
  const now = Date.now();
  const hourInMs = 3600000;

  // Initialize last 24 hours
  for (let i = 0; i < 24; i++) {
    const hourTimestamp = now - (i * hourInMs);
    const hourLabel = new Date(hourTimestamp).toISOString().substring(0, 13) + ':00';
    distribution[hourLabel] = 0;
  }

  // Count errors per hour
  errorStore.errors.forEach(err => {
    const errorTime = new Date(err.timestamp).getTime();
    if (now - errorTime <= 86400000) { // Last 24 hours
      const hourLabel = err.timestamp.substring(0, 13) + ':00';
      if (distribution.hasOwnProperty(hourLabel)) {
        distribution[hourLabel]++;
      }
    }
  });

  return distribution;
}

/**
 * Get error by ID
 */
function getErrorById(errorId) {
  return errorStore.errors.find(err => err.id === errorId);
}

/**
 * Generate error report
 */
function generateErrorReport() {
  const summary = getErrorSummary();
  const statusDistribution = getErrorDistributionByStatus();
  const hourlyDistribution = getErrorDistributionByHour();
  const errorRateStatus = checkErrorRate();

  return {
    reportId: logContext.generateErrorId(),
    generatedAt: new Date().toISOString(),
    summary,
    statusDistribution,
    hourlyDistribution,
    errorRateStatus
  };
}

module.exports = {
  trackError,
  getErrorStats,
  getRecentErrors,
  getErrorsByType,
  getErrorsByEndpoint,
  getErrorsByUser,
  getErrorSummary,
  clearErrorStore,
  checkErrorRate,
  getErrorDistributionByStatus,
  getErrorDistributionByHour,
  getErrorById,
  generateErrorReport
};