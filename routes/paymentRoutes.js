const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

router.post("/create-transaction", paymentController.createBillTransaction);
router.post("/notification-transaction", paymentController.midtransNotification);

module.exports = router;