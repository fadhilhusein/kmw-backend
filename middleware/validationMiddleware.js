const { registerMemberSchema, activateAccountSchema, loginSchema, createTransactionSchema } = require('./validationSchemas');

// Validation middleware factory
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        // Debug logging
        console.log(`🔍 Validating ${property}:`, JSON.stringify(req[property]));

        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // Return all errors, not just the first one
            stripUnknown: true // Remove unknown properties
        });

        console.log(`✅ Validated result:`, error ? 'FAILED' : 'PASSED', error ? JSON.stringify(error.details) : '');

        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                const key = detail.path.join('.');
                errors[key] = detail.message;
            });

            return res.status(400).json({
                success: false,
                error: 'Validasi gagal',
                errors
            });
        }

        // Replace request body with validated data
        req[property] = value;
        next();
    };
};

// Export validation middlewares
module.exports = {
    validateRegisterMember: () => validate(registerMemberSchema),
    validateActivateAccount: () => validate(activateAccountSchema),
    validateLogin: () => validate(loginSchema),
    validateCreateTransaction: () => validate(createTransactionSchema),
    validate
};
