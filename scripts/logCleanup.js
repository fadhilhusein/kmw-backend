/**
 * Log Cleanup Script
 *
 * Automated log management and cleanup script
 * Removes old log files based on retention policy
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const loggingConfig = require('../config/logging');

/**
 * Log file patterns and retention policies
 */
const LOG_FILE_PATTERNS = {
  error: {
    pattern: /^error-\d{4}-\d{2}-\d{2}\.log$/i,
    retention: loggingConfig.getMaxFileRetention(),
    directory: path.join(process.cwd(), 'logs')
  },
  combined: {
    pattern: /^combined-\d{4}-\d{2}-\d{2}\.log$/i,
    retention: loggingConfig.getMaxFileRetention(),
    directory: path.join(process.cwd(), 'logs')
  },
  exceptions: {
    pattern: /^exceptions-\d{4}-\d{2}-\d{2}\.log$/i,
    retention: loggingConfig.getMaxFileRetention(),
    directory: path.join(process.cwd(), 'logs')
  },
  rejections: {
    pattern: /^rejections-\d{4}-\d{2}-\d{2}\.log$/i,
    retention: loggingConfig.getMaxFileRetention(),
    directory: path.join(process.cwd(), 'logs')
  }
};

/**
 * Parse retention period (e.g., '7d', '30d', '90d')
 */
function parseRetentionPeriod(period) {
  const match = period.match(/^(\d+)([dwmy])$/i);
  if (!match) {
    throw new Error(`Invalid retention period: ${period}`);
  }

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    'd': 24 * 60 * 60 * 1000,        // days to milliseconds
    'w': 7 * 24 * 60 * 60 * 1000,    // weeks to milliseconds
    'm': 30 * 24 * 60 * 60 * 1000,   // months to milliseconds
    'y': 365 * 24 * 60 * 60 * 1000   // years to milliseconds
  };

  return value * (multipliers[unit] || multipliers['d']);
}

/**
 * Extract date from filename (e.g., 'error-2026-03-26.log' -> 2026-03-26)
 */
function extractDateFromFilename(filename, pattern) {
  const dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/);
  if (!dateMatch) {
    return null;
  }

  const dateStr = dateMatch[0];
  const date = new Date(dateStr);

  return date;
}

/**
 * Check if file is older than retention period
 */
function isFileOlderThanRetention(filePath, retentionPeriod) {
  try {
    const stats = fs.statSync(filePath);
    const fileDate = stats.mtime;
    const now = new Date();
    const age = now - fileDate;

    return age > retentionPeriod;
  } catch (error) {
    logger.warn(`Failed to check file age: ${filePath}`, {
      error: error.message
    }, 'LOG_CLEANUP');

    return false;
  }
}

/**
 * Delete old log files
 */
function deleteOldLogs(directory, pattern, retentionPeriod) {
  const files = fs.readdirSync(directory);
  let deletedCount = 0;
  let deletedSize = 0;

  files.forEach(filename => {
    if (pattern.test(filename)) {
      const filePath = path.join(directory, filename);

      try {
        if (isFileOlderThanRetention(filePath, retentionPeriod)) {
          const stats = fs.statSync(filePath);
          const fileSize = stats.size;

          fs.unlinkSync(filePath);

          deletedCount++;
          deletedSize += fileSize;

          logger.info(`Deleted old log file: ${filename}`, {
            filePath,
            fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
            retentionPeriod: `${retentionPeriod / (24 * 60 * 60 * 1000)} days`
          }, 'LOG_CLEANUP');
        }
      } catch (error) {
        logger.error(`Failed to delete log file: ${filename}`, {
          filePath,
          error: error.message
        }, 'LOG_CLEANUP');
      }
    }
  });

  return { deletedCount, deletedSize };
}

/**
 * Backup log file before deletion (optional)
 */
function backupLogFile(filePath, backupDirectory) {
  try {
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDirectory)) {
      fs.mkdirSync(backupDirectory, { recursive: true });
    }

    const filename = path.basename(filePath);
    const backupPath = path.join(backupDirectory, `${filename}.backup`);

    fs.copyFileSync(filePath, backupPath);

    logger.info(`Log file backed up: ${filename}`, {
      sourcePath: filePath,
      backupPath
    }, 'LOG_CLEANUP');

    return backupPath;
  } catch (error) {
    logger.error(`Failed to backup log file: ${path.basename(filePath)}`, {
      filePath,
      error: error.message
    }, 'LOG_CLEANUP');

    return null;
  }
}

/**
 * Get log directory statistics
 */
function getLogDirectoryStats(directory) {
  const stats = {
    totalFiles: 0,
    totalSize: 0,
    fileTypes: {},
    oldestFile: null,
    newestFile: null
  };

  try {
    const files = fs.readdirSync(directory);

    files.forEach(filename => {
      const filePath = path.join(directory, filename);
      const fileStats = fs.statSync(filePath);

      stats.totalFiles++;
      stats.totalSize += fileStats.size;

      // Count file types
      const ext = path.extname(filename).toLowerCase() || 'no_ext';
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;

      // Track oldest and newest files
      if (!stats.oldestFile || fileStats.mtime < stats.oldestFile.mtime) {
        stats.oldestFile = { filename, mtime: fileStats.mtime };
      }

      if (!stats.newestFile || fileStats.mtime > stats.newestFile.mtime) {
        stats.newestFile = { filename, mtime: fileStats.mtime };
      }
    });

    return stats;
  } catch (error) {
    logger.error(`Failed to get log directory stats: ${directory}`, {
      error: error.message
    }, 'LOG_CLEANUP');

    return stats;
  }
}

/**
 * Main cleanup function
 */
function performCleanup(options = {}) {
  const {
    backupBeforeDelete = false,
    backupDirectory = path.join(process.cwd(), 'logs', 'backups'),
    dryRun = false
  } = options;

  logger.info('Starting log cleanup', {
    options,
    timestamp: new Date().toISOString()
  }, 'LOG_CLEANUP');

  const cleanupResults = {
    totalFilesDeleted: 0,
    totalSizeDeleted: 0,
    errors: [],
    stats: {}
  };

  // Process each log file pattern
  Object.entries(LOG_FILE_PATTERNS).forEach(([logType, config]) => {
    const retentionPeriod = parseRetentionPeriod(config.retention);

    logger.info(`Processing ${logType} logs`, {
      pattern: config.pattern.source,
      retention: config.retention,
      directory: config.directory
    }, 'LOG_CLEANUP');

    try {
      if (dryRun) {
        // Dry run - just report what would be deleted
        const files = fs.readdirSync(config.directory);
        const filesToDelete = files.filter(filename =>
          config.pattern.test(filename) &&
          isFileOlderThanRetention(path.join(config.directory, filename), retentionPeriod)
        );

        logger.info(`Dry run: ${filesToDelete.length} files would be deleted`, {
          logType,
          files: filesToDelete
        }, 'LOG_CLEANUP');

        cleanupResults.stats[logType] = {
          filesWouldDelete: filesToDelete.length
        };
      } else {
        // Actual cleanup
        const { deletedCount, deletedSize } = deleteOldLogs(
          config.directory,
          config.pattern,
          retentionPeriod
        );

        cleanupResults.totalFilesDeleted += deletedCount;
        cleanupResults.totalSizeDeleted += deletedSize;
        cleanupResults.stats[logType] = {
          filesDeleted: deletedCount,
          sizeDeleted: `${(deletedSize / 1024).toFixed(2)} KB`
        };
      }
    } catch (error) {
      logger.error(`Error processing ${logType} logs`, {
        error: error.message
      }, 'LOG_CLEANUP');

      cleanupResults.errors.push({
        logType,
        error: error.message
      });
    }
  });

  // Get final log directory stats
  cleanupResults.finalStats = getLogDirectoryStats(path.join(process.cwd(), 'logs'));

  logger.info('Log cleanup completed', {
    ...cleanupResults,
    timestamp: new Date().toISOString()
  }, 'LOG_CLEANUP');

  return cleanupResults;
}

/**
 * Run cleanup as standalone script
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  args.forEach(arg => {
    if (arg === '--backup') {
      options.backupBeforeDelete = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--backup-dir=')) {
      options.backupDirectory = arg.split('=')[1];
    }
  });

  performCleanup(options)
    .then(results => {
      console.log('\n=== Log Cleanup Results ===');
      console.log(`Total files deleted: ${results.totalFilesDeleted}`);
      console.log(`Total size deleted: ${(results.totalSizeDeleted / 1024).toFixed(2)} KB`);
      console.log(`Errors: ${results.errors.length}`);
      console.log(`\nFinal stats:`);
      console.log(`- Total files: ${results.finalStats.totalFiles}`);
      console.log(`- Total size: ${(results.finalStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Oldest file: ${results.finalStats.oldestFile?.filename || 'none'}`);
      console.log(`- Newest file: ${results.finalStats.newestFile?.filename || 'none'}`);

      if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(err => {
          console.log(`- ${err.logType}: ${err.error}`);
        });
      }

      process.exit(0);
    })
    .catch(error => {
      console.error('Log cleanup failed:', error);
      logger.error('Log cleanup failed', {
        error: error.message,
        stack: error.stack
      }, 'LOG_CLEANUP');
      process.exit(1);
    });
}

module.exports = {
  performCleanup,
  deleteOldLogs,
  getLogDirectoryStats,
  parseRetentionPeriod,
  extractDateFromFilename
};