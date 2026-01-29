// controllers/authController.js
const {
    PrismaClient
} = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Kunci rahasia untuk token (Simpan di .env nanti ya, ini contoh aja)
const JWT_SECRET = process.env.JWT_SECRET || "rahasia_negara_api";

// 1. ADMIN: Daftarkan Anggota Baru (Dapat Kode Aktivasi)
exports.registerMember = async (req, res) => {
    try {
        const {
            name,
            nim,
            divisionCode,
            role
        } = req.body;

        // Cek apakah NIM sudah ada
        const existingUser = await prisma.user.findUnique({
            where: {
                nim
            }
        });
        if (existingUser) {
            return res.status(400).json({
                error: "NIM ini sudah terdaftar."
            });
        }

        // Generate Kode Aktivasi (3 digit NIM + 3 digit Random)
        const randomStr = crypto.randomBytes(2).toString('hex').toUpperCase();
        const activationCode = `${nim.slice(-3)}${randomStr}`; // Contoh: 001A7B

        // Simpan ke Database
        const newUser = await prisma.user.create({
            data: {
                name,
                nim,
                divisionCode: divisionCode, // Pastikan jadi integer
                role: role || 'STAFF',
                activationCode,
                isActive: false // Belum aktif
            }
        });

        res.json({
            message: "Anggota berhasil didaftarkan. Bagikan kode ini ke anggota.",
            data: {
                name: newUser.name,
                nim: newUser.nim,
                activationCode: newUser.activationCode // PENTING: Ini yang dikasih ke user
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Gagal mendaftarkan anggota."
        });
    }
};

// 2. MAHASISWA: Aktivasi Akun (Set Password)
exports.activateAccount = async (req, res) => {
    try {
        const {
            nim,
            code,
            password
        } = req.body;

        // Cari user
        const user = await prisma.user.findUnique({
            where: {
                nim
            }
        });

        // Validasi
        if (!user) return res.status(404).json({
            error: "NIM tidak ditemukan."
        });
        if (user.isActive) return res.status(400).json({
            error: "Akun sudah aktif. Silakan login."
        });
        if (user.activationCode !== code) return res.status(400).json({
            error: "Kode aktivasi salah!"
        });

        // Enkripsi Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update User
        await prisma.user.update({
            where: {
                nim
            },
            data: {
                password: hashedPassword,
                isActive: true,
                activationCode: null // Hapus kode agar aman
            }
        });

        res.json({
            message: "Aktivasi berhasil! Akun kamu sudah aktif."
        });

    } catch (error) {
        res.status(500).json({
            error: "Gagal aktivasi akun."
        });
    }
};

// 3. MAHASISWA/ADMIN: Login
exports.login = async (req, res) => {
    try {
        const {
            nim,
            password
        } = req.body;

        // Cari user
        const user = await prisma.user.findUnique({
            where: {
                nim
            }
        });
        if (!user) return res.status(404).json({
            error: "User tidak ditemukan."
        });

        // Cek status aktif
        if (!user.isActive) return res.status(400).json({
            error: "Akun belum diaktivasi."
        });

        // Cek password
        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) return res.status(401).json({
            error: "Password salah."
        });

        // Buat Token (Tiket masuk)
        const token = jwt.sign({
                id: user.id,
                nim: user.nim,
                role: user.role
            },
            JWT_SECRET, {
                expiresIn: '1d'
            }
        );

        res.json({
            message: "Login berhasil",
            token,
            user: {
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            error: "Gagal login."
        });
    }
};