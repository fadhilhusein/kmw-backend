// routes/staffRoutes.js
const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

// Import auth middleware
const { verifyToken } = require('../middleware/authMiddleware');
const { requireMinRole, requireRole } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(verifyToken);

// GET /api/staff - List staff with filters
// MANAJER and above can access
router.get('/',
    requireMinRole('MANAJER'),
    staffController.getStaffList
);

// GET /api/staff/:nim - Get staff detail by NIM
// MANAJER and above can access
router.get('/:nim',
    requireMinRole('MANAJER'),
    staffController.getStaffByNim
);

// PUT /api/staff/:nim - Update staff (status, role, divisionCode)
// MANAJER can only update status, KETUA can update all
router.put('/:nim',
    requireMinRole('MANAJER'),
    staffController.updateStaff
);

// DELETE /api/staff/:nim - Soft delete (set isActive=false)
// MANAJER and above can access
router.delete('/:nim',
    requireMinRole('MANAJER'),
    staffController.deleteStaff
);

module.exports = router;
