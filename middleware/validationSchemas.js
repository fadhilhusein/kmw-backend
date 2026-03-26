const Joi = require('joi');

// Validation schemas for all endpoints

// Register Member Validation
const registerMemberSchema = Joi.object({
    name: Joi.string()
        .min(5)
        .max(100)
        .required()
        .messages({
            'string.min': 'Nama harus minimal 5 karakter',
            'string.max': 'Nama maksimal 100 karakter',
            'any.required': 'Nama wajib diisi'
        }),
    nim: Joi.string()
        .pattern(/^[0-9]{12,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'NIM harus berupa 12-15 digit angka',
            'any.required': 'NIM wajib diisi'
        }),
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Format email tidak valid',
            'any.required': 'Email wajib diisi'
        }),
    divisionCode: Joi.string()
        .valid('BPH', 'CM', 'BD', 'BE', 'NP', 'HRD', 'EO', 'DR', 'VDR')
        .required()
        .messages({
            'any.only': 'Kode divisi tidak valid',
            'any.required': 'Divisi wajib dipilih'
        }),
    role: Joi.string()
        .valid('STAFF', 'MANAJER', 'KETUA', 'ADMIN')
        .default('STAFF')
        .messages({
            'any.only': 'Role tidak valid'
        })
});

// Activate Account Validation
const activateAccountSchema = Joi.object({
    nim: Joi.string()
        .pattern(/^[0-9]{12,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'NIM harus berupa 12-15 digit angka',
            'any.required': 'NIM wajib diisi'
        }),
    code: Joi.string()
        .pattern(/^[A-Z0-9]{7}$/)
        .required()
        .messages({
            'string.pattern.base': 'Kode aktivasi harus 7 karakter alphanumeric',
            'any.required': 'Kode aktivasi wajib diisi'
        }),
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
            'string.min': 'Password minimal 8 karakter',
            'string.pattern.base': 'Password harus mengandung huruf besar, kecil, angka, dan karakter spesial',
            'any.required': 'Password wajib diisi'
        })
});

// Login Validation
const loginSchema = Joi.object({
    nim: Joi.string()
        .pattern(/^[0-9]{12,15}$/)
        .required()
        .messages({
            'string.pattern.base': 'NIM harus berupa 12-15 digit angka',
            'any.required': 'NIM wajib diisi'
        }),
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password wajib diisi'
        })
});

// Create Transaction Validation
const createTransactionSchema = Joi.object({
    userId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            'number.base': 'User ID harus berupa angka',
            'any.required': 'User ID wajib diisi'
        }),
    amount: Joi.number()
        .integer()
        .min(1000)
        .max(100000000)
        .required()
        .messages({
            'number.base': 'Jumlah harus berupa angka',
            'number.min': 'Minimal pembayaran Rp 1.000',
            'number.max': 'Maksimal pembayaran Rp 100.000.000',
            'any.required': 'Jumlah wajib diisi'
        }),
    month: Joi.string()
        .pattern(/^(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December)$/)
        .required()
        .messages({
            'string.pattern.base': 'Format bulan tidak valid',
            'any.required': 'Bulan wajib diisi'
        })
});

// Export schemas
module.exports = {
    registerMemberSchema,
    activateAccountSchema,
    loginSchema,
    createTransactionSchema
};
