/**
 * Advanced Error Handler Middleware
 *
 * Comprehensive error handling with advanced logging,
 * error tracking, and structured error responses
 */

const logger = require('../utils/logger');
const errorTracker = require('../utils/errorTracker');
const logContext = require('../utils/logContext');
const sensitiveDataMasker = require('../utils/sensitiveDataMasker');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    // Generate error ID for tracking
    const errorId = errorTracker.trackError(err, req);

    // Create comprehensive error context
    const errorContext = logContext.createErrorContext(err, req);

    // Log error with full context
    logger.error(`Error occurred: ${err.message}`, {
        errorId,
        ...errorContext,
        request: sensitiveDataMasker.safeRequest(req),
        timestamp: new Date().toISOString()
    }, 'ERROR_HANDLER');

    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });

    // Prisma validation errors with enhanced logging
    if (err.code && err.code.startsWith('P2')) {
        const prismaErrors = {
            P2002: 'Data sudah ada di database (duplikat).',
            P2003: 'Referensi data tidak valid.',
            P2025: 'Data tidak ditemukan.',
            P2014: 'Terjadi konflik saat menyimpan data.',
            P2000: 'Query parameter tidak valid.',
            P2009: 'Validasi query gagal.',
            P2011: 'Null constraint violation.',
            P2012: 'Missing required value.',
            P2013: 'Missing required value for column.'
        };

        const errorMessage = prismaErrors[err.code] || 'Database error occurred.';

        logger.warn(`Prisma error ${err.code}`, {
            errorId,
            code: err.code,
            message: errorMessage,
            meta: err.meta,
            timestamp: new Date().toISOString()
        }, 'PRISMA');

        return res.status(400).json({
            success: false,
            error: errorMessage,
            code: err.code,
            errorId,
            ...(process.env.NODE_ENV !== 'production' && { meta: err.meta })
        });
    }

    // JWT errors with enhanced logging
    if (err.name === 'JsonWebTokenError') {
        logger.warn('Invalid JWT token', {
            errorId,
            message: 'Token tidak valid',
            timestamp: new Date().toISOString()
        }, 'AUTH');

        return res.status(401).json({
            success: false,
            error: 'Token tidak valid.',
            errorId
        });
    }

    if (err.name === 'TokenExpiredError') {
        logger.warn('Expired JWT token', {
            errorId,
            message: 'Token sudah kadaluarsa',
            expiredAt: err.expiredAt,
            timestamp: new Date().toISOString()
        }, 'AUTH');

        return res.status(401).json({
            success: false,
            error: 'Token sudah kadaluarsa.',
            errorId
        });
    }

    // NotBefore error
    if (err.name === 'NotBeforeError') {
        logger.warn('JWT not yet valid', {
            errorId,
            message: 'Token belum valid',
            date: err.date,
            timestamp: new Date().toISOString()
        }, 'AUTH');

        return res.status(401).json({
            success: false,
            error: 'Token belum valid.',
            errorId
        });
    }

    // Validation errors with enhanced logging
    if (err.name === 'ValidationError') {
        logger.warn('Validation error', {
            errorId,
            message: 'Validasi gagal',
            details: err.details,
            timestamp: new Date().toISOString()
        }, 'VALIDATION');

        return res.status(400).json({
            success: false,
            error: 'Validasi gagal.',
            details: err.details,
            errorId
        });
    }

    // Joi validation errors
    if (err.isJoi) {
        const details = err.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        logger.warn('Joi validation error', {
            errorId,
            message: 'Validasi gagal',
            details,
            timestamp: new Date().toISOString()
        }, 'VALIDATION');

        return res.status(400).json({
            success: false,
            error: 'Validasi gagal.',
            details,
            errorId
        });
    }

    // Custom API errors with enhanced logging
    if (err.isApiError) {
        logger.warn(`API error: ${err.message}`, {
            errorId,
            statusCode: err.statusCode,
            message: err.message,
            timestamp: new Date().toISOString()
        }, 'API_ERROR');

        return res.status(err.statusCode || 500).json({
            success: false,
            error: err.message || 'Terjadi kesalahan.',
            errorId
        });
    }

    // Multer file upload errors
    if (err.name === 'MulterError') {
        logger.warn('File upload error', {
            errorId,
            code: err.code,
            message: err.message,
            timestamp: new Date().toISOString()
        }, 'FILE_UPLOAD');

        const uploadErrors = {
            'LIMIT_FILE_SIZE': 'Ukuran file terlalu besar.',
            'LIMIT_FILE_COUNT': 'Terlalu banyak file.',
            'LIMIT_FIELD_KEY': 'Nama field terlalu panjang.',
            'LIMIT_FIELD_VALUE': 'Nilai field terlalu panjang.',
            'LIMIT_FIELD_COUNT': 'Terlalu banyak field.',
            'LIMIT_UNEXPECTED_FILE': 'File tidak diharapkan.'
        };

        return res.status(400).json({
            success: false,
            error: uploadErrors[err.code] || 'Error upload file.',
            errorId
        });
    }

    // HTTP errors (like from axios, fetch, etc.)
    if (err.response) {
        logger.error('HTTP client error', {
            errorId,
            status: err.response.status,
            data: err.response.data,
            url: err.config?.url,
            timestamp: new Date().toISOString()
        }, 'HTTP_CLIENT');

        return res.status(err.response.status || 500).json({
            success: false,
            error: 'Error saat menghubungi external service.',
            errorId
        });
    }

    // Network errors
    if (err.request && !err.response) {
        logger.error('Network error', {
            errorId,
            message: 'No response received',
            config: err.config,
            timestamp: new Date().toISOString()
        }, 'NETWORK');

        return res.status(503).json({
            success: false,
            error: 'Tidak dapat terhubung ke server. Silakan coba lagi.',
            errorId
        });
    }

    // Default error handling
    const statusCode = err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction
        ? 'Terjadi kesalahan internal server.'
        : err.message || 'Terjadi kesalahan internal server.';

    // Critical error logging for 5xx errors
    if (statusCode >= 500) {
        logger.error('Critical server error', {
            errorId,
            statusCode,
            message: err.message,
            stack: err.stack,
            request: {
                method: req.method,
                url: req.originalUrl || req.url,
                path: req.path,
                ip: req.ip
            },
            timestamp: new Date().toISOString()
        }, 'CRITICAL');
    }

    // Build error response
    const errorResponse = {
        success: false,
        error: message,
        errorId
    };

    // Add stack trace and details in non-production environments
    if (!isProduction) {
        errorResponse.stack = err.stack;
        errorResponse.details = {
            name: err.name,
            code: err.code,
            message: err.message
        };

        if (err.meta) {
            errorResponse.details.meta = err.meta;
        }
    }

    res.status(statusCode).json(errorResponse);
};

// Enhanced custom error class
class ApiError extends Error {
    constructor(message, statusCode = 500, code = null, meta = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isApiError = true;
        this.meta = meta;
        Error.captureStackTrace(this, this.constructor);
    }

    // Static methods for common API errors
    static badRequest(message, code = null) {
        return new ApiError(message, 400, code);
    }

    static unauthorized(message = 'Unauthorized', code = null) {
        return new ApiError(message, 401, code);
    }

    static forbidden(message = 'Forbidden', code = null) {
        return new ApiError(message, 403, code);
    }

    static notFound(message = 'Resource not found', code = null) {
        return new ApiError(message, 404, code);
    }

    static conflict(message, code = null) {
        return new ApiError(message, 409, code);
    }

    static unprocessable(message, code = null) {
        return new ApiError(message, 422, code);
    }

    static internal(message = 'Internal server error', code = null) {
        return new ApiError(message, 500, code);
    }

    static serviceUnavailable(message = 'Service unavailable', code = null) {
        return new ApiError(message, 503, code);
    }
}

// Enhanced 404 Not Found handler
const notFoundHandler = (req, res) => {
    const errorId = errorTracker.trackError(
        new Error(`Endpoint ${req.method} ${req.path} tidak ditemukan`),
        req
    );

    logger.warn('404 Not Found', {
        errorId,
        method: req.method,
        url: req.originalUrl || req.url,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString()
    }, 'NOT_FOUND');

    res.status(404).json({
        success: false,
        error: `Endpoint ${req.method} ${req.path} tidak ditemukan.`,
        errorId
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
    ApiError
};
