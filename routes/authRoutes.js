// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Import validation middlewares
const { validateRegisterMember, validateActivateAccount, validateLogin } = require('../middleware/validationMiddleware');

// Import rate limiting
const { strictRateLimiter, authRateLimiter } = require('../middleware/rateLimitMiddleware');

// Import auth middleware (for protected routes in future)
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');
const { requireRole, requireMinRole } = require('../middleware/roleMiddleware');

// Definisi URL with validation (RATE LIMITING ENABLED for production)
router.post('/register-member',
    // strictRateLimiter,  // Rate limit for registration
    // validateRegisterMember(),
    authController.registerMember // Dipakai Admin
);

router.post('/activate',
    // strictRateLimiter,  // Rate limit for activation
    // validateActivateAccount(),
    authController.activateAccount // Dipakai Mahasiswa
);

router.post('/login',
    authRateLimiter,  // Rate limit for login (stricter)
    // validateLogin(),
    authController.login // Dipakai Semua
);

// Example of protected route (to be implemented)
// router.get('/me', verifyToken, authController.getProfile);
// router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;