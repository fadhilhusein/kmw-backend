const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import logging and monitoring utilities
const logger = require('./utils/logger');
const errorTracker = require('./utils/errorTracker');
const prisma = require('./utils/prismaClient');

// Import routes
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');

// Import security middlewares
const { sanitizeInput, trimInput, cleanInput } = require('./middleware/sanitizeMiddleware');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiRateLimiter, authRateLimiter } = require('./middleware/rateLimitMiddleware');

// Import logging and monitoring middlewares
const {
  requestLogger,
  createRequestId,
  performanceLogger
} = require('./middleware/requestLogger');
const {
  performanceMonitor,
  memoryMonitor,
  requestRateMonitor,
  errorRateMonitor,
  healthCheckMonitor
} = require('./middleware/monitoring');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS Configuration - Whitelist allowed origins
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://kmw-admin.vercel.app', // Production frontend
    process.env.FRONTEND_URL // Add from environment if available
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middlewares
app.use(trimInput);      // Trim whitespace
app.use(sanitizeInput);  // Sanitize against XSS/SQL injection
app.use(cleanInput);     // Remove null/undefined values

// Request ID and logging middlewares
app.use(createRequestId);              // Attach unique request ID
app.use(performanceLogger);            // Log request/response
app.use(requestLogger);                // Detailed request logging

// Monitoring middlewares (can be selectively enabled)
if (process.env.ENABLE_MONITORING !== 'false') {
  app.use(performanceMonitor);         // Performance tracking
  app.use(memoryMonitor);              // Memory usage monitoring
  app.use(requestRateMonitor);         // Request rate monitoring
  app.use(errorRateMonitor);           // Error rate monitoring
}

// Rate limiting (DISABLED for development/testing)
// app.use('/api/auth', authRateLimiter);  // Stricter limit for auth
// app.use('/api', apiRateLimiter);        // General API limit

// Routes
app.use('/api/payment', paymentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/monitoring', monitoringRoutes);  // Monitoring endpoints

// Health check endpoint (no rate limit) - Simple version
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });

    logger.info('Basic health check passed', {
        requestId: req.id,
        timestamp: new Date().toISOString()
    }, 'HEALTH');
});

// Root endpoint
app.get('/', async (req, res) => {
    try {
        const serverInfo = {
            message: "KMW API Server",
            version: "1.0.0",
            status: "running",
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };

        res.json(serverInfo);

        logger.info('Root endpoint accessed', {
            requestId: req.id,
            timestamp: new Date().toISOString()
        }, 'SERVER');
    } catch (errors) {
        res.status(500).json({ error: "Gagal mengambil data!" });

        logger.error('Root endpoint error', {
            requestId: req.id,
            error: errors.message,
            timestamp: new Date().toISOString()
        }, 'SERVER');
    }
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    // Log server startup
    logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        allowedOrigins,
        timestamp: new Date().toISOString()
    }, 'SERVER');

    console.log(`🚀 Server berhasil jalan di PORT=${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📝 CORS Origins: ${allowedOrigins.join(', ')}`);

    // Start periodic health checks (if enabled)
    if (process.env.ENABLE_HEALTH_CHECK !== 'false') {
        healthCheckMonitor();
        logger.info('Health check monitoring started', {}, 'MONITORING');
    }

    // Log initial system stats
    logger.info('System initialization complete', {
        port: PORT,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
            heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`
        }
    }, 'SERVER');
});