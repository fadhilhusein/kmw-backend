/**
 * Database Error Tracker
 *
 * Advanced error tracking using database storage
 * Replaces in-memory error tracking with persistent database storage
 */

const prisma = require('./prismaClient');
const logger = require('./logger');
const logContext = require('./logContext');

/**
 * Track error in database
 */
async function trackErrorInDatabase(error, req = null, additionalContext = {}) {
  try {
    const errorId = logContext.generateErrorId();
    const timestamp = new Date();

    // Extract error information
    const errorData = {
      errorId,
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      code: error.code || null,
      status: error.status || error.statusCode || 500,
      stackTrace: error.stack || null,
      context: additionalContext,
      count: 1,
      firstOccurredAt: timestamp,
      lastOccurredAt: timestamp
    };

    // Add request information if available
    if (req) {
      errorData.requestMethod = req.method;
      errorData.requestUrl = req.originalUrl || req.url;
      errorData.requestPath = req.path;
      errorData.requestIp = req.ip;
      errorData.userAgent = req.get('user-agent');

      // Add user information if authenticated
      if (req.user) {
        errorData.userId = req.user.id;
        errorData.userRole = req.user.role;
      }
    }

    // Check if similar error exists (based on name and message)
    const existingError = await findSimilarError(errorData);

    if (existingError) {
      // Update existing error
      const updatedError = await prisma.errorLog.update({
        where: { id: existingError.id },
        data: {
          count: existingError.count + 1,
          lastOccurredAt: timestamp,
          // Update stack trace to latest occurrence
          stackTrace: errorData.stackTrace
        }
      });

      logger.info('Error count incremented', {
        errorId: existingError.errorId,
        newCount: updatedError.count,
        timestamp: new Date().toISOString()
      }, 'ERROR_TRACKING');

      return existingError.errorId;
    } else {
      // Create new error log
      await prisma.errorLog.create({
        data: errorData
      });

      logger.info('New error logged to database', {
        errorId,
        name: errorData.name,
        message: errorData.message,
        timestamp: new Date().toISOString()
      }, 'ERROR_TRACKING');

      return errorId;
    }
  } catch (dbError) {
    // If database logging fails, log to Winston as fallback
    logger.error('Failed to log error to database', {
      originalError: error.message,
      databaseError: dbError.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');

    // Return generated ID anyway for consistency
    return logContext.generateErrorId();
  }
}

/**
 * Find similar error in database
 */
async function findSimilarError(errorData) {
  try {
    return await prisma.errorLog.findFirst({
      where: {
        name: errorData.name,
        message: errorData.message,
        resolved: false // Only match unresolved errors
      },
      orderBy: {
        lastOccurredAt: 'desc'
      }
    });
  } catch (error) {
    logger.error('Failed to find similar error', {
      error: error.message
    }, 'ERROR_TRACKING');
    return null;
  }
}

/**
 * Get error statistics from database
 */
async function getErrorStatsFromDatabase() {
  try {
    const [
      totalErrors,
      unresolvedErrors,
      errorsToday,
      errorsLast24h,
      errorsByType,
      errorsByStatus
    ] = await Promise.all([
      // Total errors
      prisma.errorLog.count(),

      // Unresolved errors
      prisma.errorLog.count({
        where: { resolved: false }
      }),

      // Errors today
      prisma.errorLog.count({
        where: {
          lastOccurredAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Errors in last 24 hours
      prisma.errorLog.count({
        where: {
          lastOccurredAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Errors by type
      prisma.errorLog.groupBy({
        by: ['name'],
        _count: true,
        orderBy: {
          _count: {
            name: 'desc'
          }
        }
      }),

      // Errors by status code
      prisma.errorLog.groupBy({
        by: ['status'],
        _count: true,
        orderBy: {
          _count: {
            status: 'desc'
          }
        }
      })
    ]);

    return {
      total: totalErrors,
      unresolved: unresolvedErrors,
      today: errorsToday,
      last24h: errorsLast24h,
      byType: errorsByType.map(item => ({
        type: item.name,
        count: item._count
      })),
      byStatus: errorsByStatus.map(item => ({
        status: item.status,
        count: item._count
      }))
    };
  } catch (error) {
    logger.error('Failed to get error stats from database', {
      error: error.message
    }, 'ERROR_TRACKING');
    return {
      total: 0,
      unresolved: 0,
      today: 0,
      last24h: 0,
      byType: [],
      byStatus: []
    };
  }
}

/**
 * Get recent errors from database
 */
async function getRecentErrorsFromDatabase(limit = 10) {
  try {
    return await prisma.errorLog.findMany({
      take: limit,
      orderBy: {
        lastOccurredAt: 'desc'
      }
    });
  } catch (error) {
    logger.error('Failed to get recent errors from database', {
      error: error.message
    }, 'ERROR_TRACKING');
    return [];
  }
}

/**
 * Get error summary for dashboard
 */
async function getErrorSummaryFromDatabase() {
  try {
    const stats = await getErrorStatsFromDatabase();
    const recentErrors = await getRecentErrorsFromDatabase(5);

    // Get top error types (by count)
    const topErrorTypes = stats.byType.slice(0, 5);

    // Get errors by endpoint (from requestPath)
    const errorsByPath = await prisma.errorLog.groupBy({
      by: ['requestPath'],
      where: {
        requestPath: {
          not: null
        }
      },
      _count: true,
      orderBy: {
        _count: {
          requestPath: 'desc'
        }
      },
      take: 5
    });

    return {
      overview: {
        totalErrors: stats.total,
        unresolvedErrors: stats.unresolved,
        errorsToday: stats.today,
        errorsLast24h: stats.last24h
      },
      topErrorTypes,
      topEndpoints: errorsByPath.map(item => ({
        endpoint: item.requestPath,
        count: item._count
      })),
      recentErrors: recentErrors.map(err => ({
        id: err.errorId,
        name: err.name,
        message: err.message,
        status: err.status,
        timestamp: err.lastOccurredAt,
        count: err.count
      }))
    };
  } catch (error) {
    logger.error('Failed to get error summary from database', {
      error: error.message
    }, 'ERROR_TRACKING');
    return {
      overview: { totalErrors: 0, unresolvedErrors: 0, errorsToday: 0, errorsLast24h: 0 },
      topErrorTypes: [],
      topEndpoints: [],
      recentErrors: []
    };
  }
}

/**
 * Get error by ID
 */
async function getErrorByIdFromDatabase(errorId) {
  try {
    return await prisma.errorLog.findUnique({
      where: { errorId }
    });
  } catch (error) {
    logger.error('Failed to get error by ID from database', {
      errorId,
      error: error.message
    }, 'ERROR_TRACKING');
    return null;
  }
}

/**
 * Get errors by user
 */
async function getErrorsByUserFromDatabase(userId, limit = 10) {
  try {
    return await prisma.errorLog.findMany({
      where: { userId },
      take: limit,
      orderBy: {
        lastOccurredAt: 'desc'
      }
    });
  } catch (error) {
    logger.error('Failed to get errors by user from database', {
      userId,
      error: error.message
    }, 'ERROR_TRACKING');
    return [];
  }
}

/**
 * Resolve error
 */
async function resolveErrorInDatabase(errorId, resolvedBy, resolvedNote) {
  try {
    return await prisma.errorLog.update({
      where: { errorId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolvedNote
      }
    });
  } catch (error) {
    logger.error('Failed to resolve error in database', {
      errorId,
      error: error.message
    }, 'ERROR_TRACKING');
    return null;
  }
}

/**
 * Check error rate status
 */
async function checkErrorRateFromDatabase() {
  try {
    const errorsLastHour = await prisma.errorLog.count({
      where: {
        lastOccurredAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });

    const thresholds = {
      critical: 100,
      high: 50,
      moderate: 20
    };

    if (errorsLastHour >= thresholds.critical) {
      return {
        level: 'critical',
        message: `Critical error rate: ${errorsLastHour} errors per hour`,
        rate: errorsLastHour
      };
    } else if (errorsLastHour >= thresholds.high) {
      return {
        level: 'high',
        message: `High error rate: ${errorsLastHour} errors per hour`,
        rate: errorsLastHour
      };
    } else if (errorsLastHour >= thresholds.moderate) {
      return {
        level: 'moderate',
        message: `Moderate error rate: ${errorsLastHour} errors per hour`,
        rate: errorsLastHour
      };
    }

    return {
      level: 'normal',
      message: 'Normal error rate',
      rate: errorsLastHour
    };
  } catch (error) {
    logger.error('Failed to check error rate from database', {
      error: error.message
    }, 'ERROR_TRACKING');
    return {
      level: 'unknown',
      message: 'Unable to determine error rate',
      rate: 0
    };
  }
}

module.exports = {
  trackErrorInDatabase,
  findSimilarError,
  getErrorStatsFromDatabase,
  getRecentErrorsFromDatabase,
  getErrorSummaryFromDatabase,
  getErrorByIdFromDatabase,
  getErrorsByUserFromDatabase,
  resolveErrorInDatabase,
  checkErrorRateFromDatabase
};