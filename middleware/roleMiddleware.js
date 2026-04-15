// Role hierarchy (higher index = higher privilege)
const ROLE_HIERARCHY = {
    'STAFF': 1,
    'MANAJER': 2,
    'KETUA': 3,
    'ADMIN': 4
};

// Check if user has required role
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Anda harus login terlebih dahulu.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Anda tidak memiliki izin untuk mengakses resource ini.'
            });
        }

        next();
    };
};

// Check if user has minimum role level
const requireMinRole = (minRole) => {
    const requiredLevel = ROLE_HIERARCHY[minRole];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Anda harus login terlebih dahulu.'
            });
        }

        const userLevel = ROLE_HIERARCHY[req.user.role];

        if (!userLevel || userLevel < requiredLevel) {
            return res.status(403).json({
                success: false,
                error: `Anda membutuhkan role ${minRole} atau lebih tinggi untuk mengakses resource ini.`
            });
        }

        next();
    };
};

// Check if user belongs to specific division
const requireDivision = (...allowedDivisions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Anda harus login terlebih dahulu.'
            });
        }

        if (!req.user.divisi || !allowedDivisions.includes(req.user.divisi)) {
            return res.status(403).json({
                success: false,
                error: 'Anda tidak memiliki izin untuk mengakses resource divisi ini.'
            });
        }

        next();
    };
};

// Check if user is accessing their own resource or has higher role
const requireOwnershipOrRole = (resourceIdParam, minRole = 'MANAJER') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Anda harus login terlebih dahulu.'
            });
        }

        const userLevel = ROLE_HIERARCHY[req.user.role];
        const requiredLevel = ROLE_HIERARCHY[minRole];

        // If user has high enough role, allow access
        if (userLevel >= requiredLevel) {
            return next();
        }

        // Otherwise, check ownership (to be implemented in route handler)
        req.checkOwnership = true;
        next();
    };
};

// Helper to check ownership in route handlers
const checkUserOwnership = (userNim, resourceUserNim) => {
    return userNim === resourceUserNim;
};

module.exports = {
    requireRole,
    requireMinRole,
    requireDivision,
    requireOwnershipOrRole,
    checkUserOwnership,
    ROLE_HIERARCHY
};
