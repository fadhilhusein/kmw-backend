/**
 * Monitoring Routes
 *
 * Routes for system health monitoring, error tracking,
 * and performance metrics
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const errorTracker = require('../utils/errorTracker');
const { getPerformanceStats } = require('../middleware/monitoring');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });

    logger.info('Health check passed', {
      requestId: req.id,
      timestamp: new Date().toISOString()
    }, 'HEALTH');

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });

    logger.error('Health check failed', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'HEALTH');
  }
});

/**
 * GET /health/detailed
 * Detailed health check with all components
 */
router.get('/health/detailed', async (req, res) => {
  const healthChecks = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    components: {}
  };

  try {
    // Database health check
    const dbStartTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbDuration = Date.now() - dbStartTime;

    healthChecks.components.database = {
      status: 'healthy',
      responseTime: `${dbDuration}ms`,
      message: 'Database connection successful'
    };
  } catch (error) {
    healthChecks.components.database = {
      status: 'unhealthy',
      message: error.message
    };
  }

  // Memory health check
  const memory = process.memoryUsage();
  const heapUsedPercentage = (memory.heapUsed / memory.heapTotal) * 100;

  healthChecks.components.memory = {
    status: heapUsedPercentage < 90 ? 'healthy' : 'warning',
    heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    heapUsedPercentage: `${heapUsedPercentage.toFixed(2)}%`,
    rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`
  };

  // Overall health status
  const allHealthy = Object.values(healthChecks.components).every(
    component => component.status === 'healthy'
  );

  healthChecks.status = allHealthy ? 'healthy' : 'degraded';

  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json(healthChecks);

  logger.info('Detailed health check', {
    requestId: req.id,
    status: healthChecks.status,
    components: healthChecks.components,
    timestamp: new Date().toISOString()
  }, 'HEALTH');
});

/**
 * GET /metrics
 * Performance metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = getPerformanceStats();

    res.status(200).json({
      success: true,
      data: metrics
    });

    logger.info('Metrics retrieved', {
      requestId: req.id,
      timestamp: new Date().toISOString()
    }, 'METRICS');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });

    logger.error('Failed to retrieve metrics', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'METRICS');
  }
});

/**
 * GET /errors/stats
 * Error statistics
 */
router.get('/errors/stats', (req, res) => {
  try {
    const stats = errorTracker.getErrorStats();

    res.status(200).json({
      success: true,
      data: stats
    });

    logger.info('Error stats retrieved', {
      requestId: req.id,
      stats,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error statistics'
    });

    logger.error('Failed to retrieve error stats', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * GET /errors/recent
 * Recent errors
 */
router.get('/errors/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recentErrors = errorTracker.getRecentErrors(limit);

    res.status(200).json({
      success: true,
      data: recentErrors,
      count: recentErrors.length
    });

    logger.info('Recent errors retrieved', {
      requestId: req.id,
      limit,
      count: recentErrors.length,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent errors'
    });

    logger.error('Failed to retrieve recent errors', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * GET /errors/summary
 * Error summary for dashboard
 */
router.get('/errors/summary', (req, res) => {
  try {
    const summary = errorTracker.getErrorSummary();

    res.status(200).json({
      success: true,
      data: summary
    });

    logger.info('Error summary retrieved', {
      requestId: req.id,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error summary'
    });

    logger.error('Failed to retrieve error summary', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * GET /errors/:errorId
 * Get specific error by ID
 */
router.get('/errors/:errorId', (req, res) => {
  try {
    const { errorId } = req.params;
    const error = errorTracker.getErrorById(errorId);

    if (!error) {
      res.status(404).json({
        success: false,
        error: 'Error not found'
      });

      return;
    }

    res.status(200).json({
      success: true,
      data: error
    });

    logger.info('Error retrieved', {
      requestId: req.id,
      errorId,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error'
    });

    logger.error('Failed to retrieve error', {
      requestId: req.id,
      errorId: req.params.errorId,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * GET /errors/type/:errorType
 * Get errors by type
 */
router.get('/errors/type/:errorType', (req, res) => {
  try {
    const { errorType } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const errors = errorTracker.getErrorsByType(errorType, limit);

    res.status(200).json({
      success: true,
      data: errors,
      count: errors.length
    });

    logger.info('Errors by type retrieved', {
      requestId: req.id,
      errorType,
      limit,
      count: errors.length,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve errors by type'
    });

    logger.error('Failed to retrieve errors by type', {
      requestId: req.id,
      errorType: req.params.errorType,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * GET /errors/endpoint/:method/:path
 * Get errors by endpoint
 */
router.get('/errors/endpoint/:method/:path', (req, res) => {
  try {
    const { method, path } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const errors = errorTracker.getErrorsByEndpoint(method, path, limit);

    res.status(200).json({
      success: true,
      data: errors,
      count: errors.length
    });

    logger.info('Errors by endpoint retrieved', {
      requestId: req.id,
      endpoint: `${method}:${path}`,
      limit,
      count: errors.length,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve errors by endpoint'
    });

    logger.error('Failed to retrieve errors by endpoint', {
      requestId: req.id,
      endpoint: `${req.params.method}:${req.params.path}`,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * GET /errors/check-rate
 * Check error rate status
 */
router.get('/errors/check-rate', (req, res) => {
  try {
    const rateStatus = errorTracker.checkErrorRate();

    res.status(200).json({
      success: true,
      data: rateStatus
    });

    logger.info('Error rate check', {
      requestId: req.id,
      rateStatus,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check error rate'
    });

    logger.error('Failed to check error rate', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * GET /errors/report
 * Generate error report
 */
router.get('/errors/report', (req, res) => {
  try {
    const report = errorTracker.generateErrorReport();

    res.status(200).json({
      success: true,
      data: report
    });

    logger.info('Error report generated', {
      requestId: req.id,
      reportId: report.reportId,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate error report'
    });

    logger.error('Failed to generate error report', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

/**
 * DELETE /errors/clear
 * Clear error store (use with caution)
 */
router.delete('/errors/clear', (req, res) => {
  try {
    errorTracker.clearErrorStore();

    res.status(200).json({
      success: true,
      message: 'Error store cleared successfully'
    });

    logger.info('Error store cleared', {
      requestId: req.id,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear error store'
    });

    logger.error('Failed to clear error store', {
      requestId: req.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'ERROR_TRACKING');
  }
});

module.exports = router;