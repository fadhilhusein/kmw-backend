const express = require('express');
const cors = require('cors');
const { PrismaClient } = require("@prisma/client");
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware

app.use(cors());
app.use(express.json());

// Auth Payment
app.use('/api/payment', paymentRoutes)

// Auth Routes
app.use('/api/auth', authRoutes);

// Route cek
app.get('/', async (req, res) => {
    try {
        res.json("Koneksi Berhasil!");
    } catch (errors) {
        res.status(500).json({errors: "Gagal mengambil data divisi!"})
    }
})

app.listen(PORT, () => {
    console.log("Server berhasil jalan di PORT=" + PORT)
})