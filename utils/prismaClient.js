/**
 * Prisma Client with Query Logging
 *
 * Extended Prisma client with query logging,
 * slow query detection, and performance monitoring
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');
const logContext = require('./logContext');

// Create base Prisma client
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Query timing store
const queryTimings = new Map();

// Query logging middleware
prisma.$on('query', (e) => {
  const queryId = logContext.generateRequestId();
  const startTime = Date.now();

  queryTimings.set(queryId, { startTime, query: e.query });

  // Log query details in debug mode
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Prisma query: ${e.query}`, {
      queryId,
      duration: `${e.duration}ms`,
      params: e.params,
      target: e.target,
      timestamp: new Date().toISOString()
    }, 'PRISMA');
  }

  // Log slow queries (> 1000ms)
  if (e.duration > 1000) {
    logger.warn(`Slow Prisma query detected (${e.duration}ms)`, {
      queryId,
      query: e.query.substring(0, 200), // Truncate long queries
      duration: `${e.duration}ms`,
      params: e.params,
      target: e.target,
      timestamp: new Date().toISOString()
    }, 'PRISMA_PERFORMANCE');
  } else if (e.duration > 500) {
    logger.info(`Prisma query took ${e.duration}ms`, {
      queryId,
      query: e.query.substring(0, 100),
      duration: `${e.duration}ms`,
      target: e.target,
      timestamp: new Date().toISOString()
    }, 'PRISMA_PERFORMANCE');
  }
});

// Error logging
prisma.$on('error', (e) => {
  const errorId = logContext.generateErrorId();

  logger.error('Prisma error occurred', {
    errorId,
    message: e.message,
    target: e.target,
    timestamp: new Date().toISOString()
  }, 'PRISMA');

  console.error('Prisma Error:', e);
});

// Warning logging
prisma.$on('warn', (e) => {
  logger.warn('Prisma warning', {
    message: e.message,
    timestamp: new Date().toISOString()
  }, 'PRISMA');

  console.warn('Prisma Warning:', e);
});

/**
 * Get query statistics
 */
function getQueryStats() {
  const stats = {
    totalQueries: queryTimings.size,
    slowQueries: 0,
    averageDuration: 0,
    queriesByTarget: {}
  };

  let totalDuration = 0;

  queryTimings.forEach(({ startTime, query }) => {
    // Extract target from query (simplified)
    const targetMatch = query.match(/FROM\s+["']?(\w+)/i);
    const target = targetMatch ? targetMatch[1] : 'unknown';

    if (!stats.queriesByTarget[target]) {
      stats.queriesByTarget[target] = {
        count: 0,
        totalDuration: 0
      };
    }

    stats.queriesByTarget[target].count++;
    totalDuration += 100; // Placeholder, real duration would be from event

    // Simplified check for slow queries
    if (query.toLowerCase().includes('slow')) {
      stats.slowQueries++;
    }
  });

  stats.averageDuration = stats.totalQueries > 0 ? totalDuration / stats.totalQueries : 0;

  return stats;
}

/**
 * Clear query timing store
 */
function clearQueryTimings() {
  queryTimings.clear();
  logger.info('Query timings cleared', {}, 'PRISMA');
}

/**
 * Create a Prisma client wrapper with automatic query timing
 */
function createPrismaWithTiming() {
  const prismaWithTiming = new PrismaClient();

  // Wrap all query methods
  const queryMethods = [
    'findUnique',
    'findFirst',
    'findMany',
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    'count',
    'aggregate',
    'groupBy'
  ];

  // Wrap each model
  const modelNames = [
    'User', 'Division', 'Project', 'Task', 'CrossDivisionRequest', 'Bill'
  ];

  modelNames.forEach(modelName => {
    const model = prismaWithTiming[modelName];

    queryMethods.forEach(method => {
      if (model && model[method]) {
        const originalMethod = model[method].bind(model);

        model[method] = async function(...args) {
          const startTime = Date.now();
          const queryId = logContext.generateRequestId();

          try {
            const result = await originalMethod(...args);
            const duration = Date.now() - startTime;

            // Log query execution
            logger.database(
              {
                model: modelName,
                action: method,
                id: queryId
              },
              duration,
              null
            );

            return result;
          } catch (error) {
            const duration = Date.now() - startTime;

            // Log query error
            logger.database(
              {
                model: modelName,
                action: method,
                id: queryId
              },
              duration,
              error
            );

            throw error;
          }
        };
      }
    });
  });

  return prismaWithTiming;
}

// Export the regular Prisma client
module.exports = prisma;

// Export utilities
module.exports.getQueryStats = getQueryStats;
module.exports.clearQueryTimings = clearQueryTimings;
module.exports.createPrismaWithTiming = createPrismaWithTiming;