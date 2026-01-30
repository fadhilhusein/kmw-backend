const midtransClient = require('midtrans-client');
const {
    PrismaClient
} = require('@prisma/client');
const prisma = new PrismaClient();

// Inisialisasi Snap
let snap = new midtransClient.Snap({
    isProduction: false, // Pakai false dulu untuk Sandbox
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

exports.createBillTransaction = async (req, res) => {
    try {
        const {
            userId,
            amount,
            month
        } = req.body; // Data dari frontend

        // 1. Buat Order ID Unik
        // Tips: Pakai timestamp biar gak pernah duplikat
        const orderId = `KAS-${userId}-${Date.now()}`;

        // 2. Siapkan parameter untuk Midtrans
        let parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: amount
            },
            credit_card: {
                secure: true
            },
            customer_details: {
                // Ambil data user dari database prisma di sini (opsional tapi bagus)
            }
        };

        // 3. Minta Token ke Midtrans
        const transaction = await snap.createTransaction(parameter);
        const snapToken = transaction.token;

        // 4. Simpan ke Database kita (PENTING!)
        await prisma.bill.create({
            data: {
                title: `Uang Kas ${month}`,
                amount: parseInt(amount),
                orderId: orderId,
                snapToken: snapToken,
                userId: userId,
                status: 'PENDING'
            }
        });

        // 5. Kirim Token ke Frontend
        res.json({
            snapToken
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

exports.midtransNotification = async (req, res) => {
    try {
        const statusResponse = await snap.transaction.notification(req.body);

        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        let updateStatus = 'PENDING';

        // Logika standar Midtrans
        if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
            updateStatus = 'PAID';
        } else if (transactionStatus == 'cancel' || transactionStatus == 'deny' || transactionStatus == 'expire') {
            updateStatus = 'FAILED';
        }

        // Update status di Database Prisma
        await prisma.bill.update({
            where: {
                orderId: orderId
            },
            data: {
                status: updateStatus
            }
        });

        res.status(200).send('OK'); // Wajib balas OK ke Midtrans

    } catch (error) {
        res.status(500).send('Terjadi kesalahan: ' + error);
    }
};