// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Definisi URL
router.post('/register-member', authController.registerMember); // Dipakai Admin
router.post('/activate', authController.activateAccount);       // Dipakai Mahasiswa
router.post('/login', authController.login);                    // Dipakai Semua

module.exports = router;