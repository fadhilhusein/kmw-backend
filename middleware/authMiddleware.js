const jose = require("jose");

// JWT Secret from environment - throw error if missing for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Please set it in your .env file.');
}
const encodedKey = new TextEncoder().encode(JWT_SECRET);

// JWT Verification Middleware
const verifyToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Token tidak ditemukan. Silakan login kembali.'
            });
        }

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;

        // Verify token
        const { payload } = await jose.jwtVerify(token, encodedKey);

        // Check if token is expired
        if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
            return res.status(401).json({
                success: false,
                error: 'Token sudah kadaluarsa. Silakan login kembali.'
            });
        }

        // Attach user info to request
        req.user = {
            nim: payload.nim,
            role: payload.role,
            divisi: payload.divisi,
            name: payload.name
        };

        next();
    } catch (error) {
        // Use proper logging instead of console.error in production
        return res.status(401).json({
            success: false,
            error: 'Token tidak valid. Silakan login kembali.'
        });
    }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return next();
        }

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;

        const { payload } = await jose.jwtVerify(token, encodedKey);

        if (payload.expiresAt && new Date(payload.expiresAt) >= new Date()) {
            req.user = {
                nim: payload.nim,
                role: payload.role,
                divisi: payload.divisi,
                name: payload.name
            };
        }

        next();
    } catch (error) {
        // For optional auth, just continue without user
        next();
    }
};

module.exports = {
    verifyToken,
    optionalAuth
};
