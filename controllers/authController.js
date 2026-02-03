// controllers/authController.js
const {
    PrismaClient
} = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const jose = require("jose")
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Kunci rahasia untuk token (Simpan di .env nanti ya, ini contoh aja)
const JWT_SECRET = process.env.JWT_SECRET || "rahasia_negara_api";
const encodedKey = new TextEncoder().encode(JWT_SECRET);

// 1. ADMIN: Daftarkan Anggota Baru (Dapat Kode Aktivasi)
exports.registerMember = async (req, res) => {
    try {
        const {
            name,
            nim,
            email,
            divisionCode,
            role
        } = req.body;

        // Cek apakah NIM sudah ada
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    {nim: nim},
                    {name: name},
                    {email: email},
                ]
            }
        });
        if (existingUser) {
            return res.status(400).json({
                error: "NIM atau Nama atau Email ini sudah terdaftar."
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
                email,
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
                email: newUser.email,
                activationCode: newUser.activationCode // PENTING: Ini yang dikasih ke user
            }
        });

    } catch (error) {
        res.status(500).json({
            error: "Gagal mendaftarkan anggota: " + error.message
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
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const token = await new jose.SignJWT({nim: user.nim, role: user.role, divisi: user.divisionCode, name: user.name, expiresAt})
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(encodedKey);

        res.json({
            message: "Login berhasil",
            token,
            user: {
                name: user.name,
                role: user.role,
                divisi: user.divisionCode
            }
        });

    } catch (error) {
        res.status(500).json({
            error: "Gagal login."
        });
    }
};