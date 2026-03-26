const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Import validation middleware
const { validateCreateTransaction } = require("../middleware/validationMiddleware");

// Import auth and role middlewares
const { verifyToken } = require("../middleware/authMiddleware");
const { requireMinRole } = require("../middleware/roleMiddleware");

// Payment routes - require authentication and minimum MANAJER role
router.post("/create-transaction",
    verifyToken,                // Must be logged in
    requireMinRole('STAFF'),    // At least STAFF can create transactions
    validateCreateTransaction(),
    paymentController.createBillTransaction
);

// Midtrans notification - no auth required (public webhook)
router.post("/notification-transaction",
    paymentController.midtransNotification
);

module.exports = router;