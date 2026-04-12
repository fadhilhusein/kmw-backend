const rateLimit = require('express-rate-limit');

// Rate limit configurations for different endpoints
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs, // Time window in milliseconds
        max, // Maximum requests per windowMs
        message: {
            success: false,
            error: message
        },
        standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        handler: (req, res) => {
            res.status(429).json({
                success: false,
                error: message
            });
        }
    });
};

// Auth endpoints - stricter limits
const authRateLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 requests
    'Terlalu banyak percobaan login/register. Silakan tunggu 15 menit.'
);

// General API endpoints
const apiRateLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    100, // 100 requests
    'Terlalu banyak permintaan. Silakan tunggu 1 menit.'
);

// Strict rate limit for sensitive operations
const strictRateLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 requests
    'Anda telah mencapai batas operasi untuk jam ini. Silakan tunggu.'
);

// Password reset / sensitive operations
const passwordRateLimiter = createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 requests
    'Terlalu banyak percobaan password reset. Silakan tunggu 1 jam.'
);

module.exports = {
    authRateLimiter,
    apiRateLimiter,
    strictRateLimiter,
    passwordRateLimiter
};
