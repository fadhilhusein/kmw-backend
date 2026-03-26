/**
 * Monitoring Middleware
 *
 * Performance monitoring and metrics collection middleware
 * Tracks system health, performance metrics, and resource usage
 */

const logger = require('../utils/logger');
const logContext = require('../utils/logContext');

/**
 * Performance monitoring middleware
 * Tracks performance metrics for each request
 */
function performanceMonitor(req, res, next) {
  const startTime = Date.now();
  req.startTime = startTime;

  // Track middleware timing
  req.middlewareTimings = [];

  // Wrap next to track middleware execution time
  const originalNext = next;
  let currentMiddleware = 0;

  const trackedNext = (error) => {
    const timing = Date.now() - req.middlewareStartTime;
    req.middlewareTimings.push({
      order: currentMiddleware++,
      timing: `${timing}ms`
    });
    return originalNext(error);
  };

  res.on('finish', () => {
    const totalTime = Date.now() - startTime;

    // Log performance metrics
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      totalTime: `${totalTime}ms`,
      statusCode: res.statusCode,
      middlewareTimings: req.middlewareTimings,
      timestamp: new Date().toISOString()
    }, 'MONITORING');

    // Log slow requests
    if (totalTime > 2000) {
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl || req.url,
        totalTime: `${totalTime}ms`,
        statusCode: res.statusCode
      }, 'PERFORMANCE');
    }
  });

  req.middlewareStartTime = Date.now();
  return trackedNext;
}

/**
 * Memory usage monitoring middleware
 * Logs memory usage for each request
 */
function memoryMonitor(req, res, next) {
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endMemory = process.memoryUsage();
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external
    };

    // Log memory usage
    logger.debug('Memory usage', {
      requestId: req.id,
      startMemory: formatMemory(startMemory),
      endMemory: formatMemory(endMemory),
      memoryDiff: formatMemory(memoryDiff),
      heapUsedPercentage: ((endMemory.heapUsed / endMemory.heapTotal) * 100).toFixed(2) + '%',
      timestamp: new Date().toISOString()
    }, 'MEMORY');

    // Alert on high memory usage
    if (endMemory.heapUsed > 500 * 1024 * 1024) { // > 500MB
      logger.warn('High memory usage detected', {
        requestId: req.id,
        heapUsed: formatMemory(endMemory.heapUsed),
        heapTotal: formatMemory(endMemory.heapTotal),
        timestamp: new Date().toISOString()
      }, 'MEMORY');
    }
  });

  next();
}

/**
 * Request rate monitoring middleware
 * Tracks request rates and detects unusual patterns
 */
const requestRateMonitor = (() => {
  let requestCount = 0;
  let lastResetTime = Date.now();
  const requestHistory = [];

  return function(req, res, next) {
    requestCount++;
    const now = Date.now();

    // Track request timing
    requestHistory.push({
      timestamp: now,
      method: req.method,
      url: req.originalUrl || req.url,
      requestId: req.id
    });

    // Keep only last 1000 requests in history
    if (requestHistory.length > 1000) {
      requestHistory.shift();
    }

    // Reset counter every minute
    if (now - lastResetTime >= 60000) {
      const requestsPerMinute = requestCount;
      requestCount = 0;
      lastResetTime = now;

      logger.info('Request rate statistics', {
        requestsPerMinute,
        timestamp: new Date().toISOString()
      }, 'RATE_MONITORING');

      // Alert on high request rate
      if (requestsPerMinute > 1000) {
        logger.warn('High request rate detected', {
          requestsPerMinute,
          timestamp: new Date().toISOString()
        }, 'RATE_MONITORING');
      }
    }

    // Calculate requests per second (last 10 seconds)
    const requestsInLast10s = requestHistory.filter(
      req => now - req.timestamp <= 10000
    ).length;
    const requestsPerSecond = (requestsInLast10s / 10).toFixed(2);

    res.setHeader('X-Request-Rate', `${requestsPerSecond} req/s`);

    next();
  };
})();

/**
 * Error rate monitoring middleware
 * Tracks error rates and alerts on unusual patterns
 */
const errorRateMonitor = (() => {
  let errorCount = 0;
  let requestCount = 0;
  let lastResetTime = Date.now();
  const errorHistory = [];

  return function(req, res, next) {
    requestCount++;

    res.on('finish', () => {
      if (res.statusCode >= 400) {
        errorCount++;
        const now = Date.now();

        // Track error details
        errorHistory.push({
          timestamp: now,
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          requestId: req.id
        });

        // Keep only last 100 errors in history
        if (errorHistory.length > 100) {
          errorHistory.shift();
        }

        // Reset counters every minute
        if (now - lastResetTime >= 60000) {
          const errorsPerMinute = errorCount;
          const requestsPerMinute = requestCount;
          const errorRate = (errorCount / requestCount * 100).toFixed(2);

          logger.info('Error rate statistics', {
            errorsPerMinute,
            requestsPerMinute,
            errorRate: `${errorRate}%`,
            timestamp: new Date().toISOString()
          }, 'ERROR_RATE_MONITOR');

          // Alert on high error rate
          if (parseFloat(errorRate) > 10) {
            logger.warn('High error rate detected', {
              errorsPerMinute,
              requestsPerMinute,
              errorRate: `${errorRate}%`,
              timestamp: new Date().toISOString()
            }, 'ERROR_RATE_MONITOR');
          }

          errorCount = 0;
          requestCount = 0;
          lastResetTime = now;
        }
      }
    });

    next();
  };
})();

/**
 * Health check monitoring middleware
 * Periodically checks system health
 */
function healthCheckMonitor() {
  setInterval(() => {
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    const cpuUsage = process.cpuUsage();

    logger.info('System health check', {
      memory: formatMemory(memory),
      heapUsedPercentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2) + '%',
      uptime: formatUptime(uptime),
      cpuUsage: formatCPU(cpuUsage),
      timestamp: new Date().toISOString()
    }, 'HEALTH');

    // Alert on critical health issues
    if (memory.heapUsed / memory.heapTotal > 0.9) {
      logger.error('Critical: Heap usage above 90%', {
        heapUsed: formatMemory(memory.heapUsed),
        heapTotal: formatMemory(memory.heapTotal),
        heapUsedPercentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2) + '%'
      }, 'HEALTH');
    }

    if (uptime < 60 && process.env.NODE_ENV === 'production') {
      logger.warn('Server restarted recently (uptime < 1 minute)', {
        uptime: formatUptime(uptime),
        timestamp: new Date().toISOString()
      }, 'HEALTH');
    }
  }, 60000); // Check every minute
}

/**
 * Middleware execution time tracker
 * Tracks execution time for specific middleware or operations
 */
function middlewareExecutionTime(middlewareName) {
  return function(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      logger.debug(`${middlewareName} execution time`, {
        requestId: req.id,
        duration: `${duration}ms`,
        method: req.method,
        url: req.originalUrl || req.url
      }, 'MIDDLEWARE_TIMING');
    });

    next();
  };
}

/**
 * Aggregate performance statistics
 */
function getPerformanceStats() {
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  return {
    memory: {
      rss: formatMemory(memory.rss),
      heapTotal: formatMemory(memory.heapTotal),
      heapUsed: formatMemory(memory.heapUsed),
      external: formatMemory(memory.external),
      heapUsedPercentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(2) + '%'
    },
    uptime: formatUptime(uptime),
    cpu: formatCPU(process.cpuUsage()),
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      arch: process.arch
    },
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };
}

/**
 * Format memory object for display
 */
function formatMemory(memory) {
  return {
    rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`
  };
}

/**
 * Format uptime for display
 */
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours}h ${minutes}m ${secs}s`;
}

/**
 * Format CPU usage for display
 */
function formatCPU(cpuUsage) {
  const user = (cpuUsage.user / 1000000).toFixed(2);
  const system = (cpuUsage.system / 1000000).toFixed(2);

  return {
    user: `${user}s`,
    system: `${system}s`,
    total: `${(parseFloat(user) + parseFloat(system)).toFixed(2)}s`
  };
}

module.exports = {
  performanceMonitor,
  memoryMonitor,
  requestRateMonitor,
  errorRateMonitor,
  healthCheckMonitor,
  middlewareExecutionTime,
  getPerformanceStats
};