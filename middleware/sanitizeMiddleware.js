// Input sanitization middleware

const sanitizeInput = (req, res, next) => {
    // Helper function to sanitize string
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;

        // Remove potential XSS characters
        let sanitized = str
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');

        // Remove potential SQL injection patterns (basic)
        sanitized = sanitized
            .replace(/SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER|CREATE|WHERE/gi, '')
            .replace(/--|\/\*|\*\/|;/g, '');

        return sanitized.trim();
    };

    // Helper function to sanitize object recursively
    const sanitizeObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];

                if (typeof value === 'string') {
                    sanitized[key] = sanitizeString(value);
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = sanitizeObject(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
        return sanitized;
    };

    // Sanitize body, query, and params
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }

    if (req.query) {
        req.query = sanitizeObject(req.query);
    }

    if (req.params) {
        req.params = sanitizeObject(req.params);
    }

    next();
};

// Remove whitespace from inputs
const trimInput = (req, res, next) => {
    const trimStrings = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        const trimmed = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];

                if (typeof value === 'string') {
                    trimmed[key] = value.trim();
                } else if (typeof value === 'object' && value !== null) {
                    trimmed[key] = trimStrings(value);
                } else {
                    trimmed[key] = value;
                }
            }
        }
        return trimmed;
    };

    if (req.body) {
        req.body = trimStrings(req.body);
    }

    if (req.query) {
        req.query = trimStrings(req.query);
    }

    next();
};

// Remove null/undefined values from objects
const cleanInput = (req, res, next) => {
    const cleanObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;

        const cleaned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];

                if (value !== null && value !== undefined && value !== '') {
                    if (typeof value === 'object' && value !== null) {
                        cleaned[key] = cleanObject(value);
                    } else {
                        cleaned[key] = value;
                    }
                }
            }
        }
        return cleaned;
    };

    if (req.body) {
        req.body = cleanObject(req.body);
    }

    next();
};

module.exports = {
    sanitizeInput,
    trimInput,
    cleanInput
};
