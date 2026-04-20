// controllers/staffController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. GET /api/staff - Get staff list with filters
exports.getStaffList = async (req, res) => {
    try {
        const { divisionCode, isActive, search, page = 1, limit = 25 } = req.query;

        // Build where clause
        const where = {};

        // Filter by role (exclude ADMIN from list)
        if (req.user.role === 'KETUA') {
        where.role = { in: ['MANAJER','STAFF'] };
        } else if (req.user.role === 'MANAJER') {
        where.role = {in: ['STAFF'] };
        };

        // Division filter - MANAJER can only see their own division
        if (req.user.role === 'MANAJER') {
            where.divisionCode = req.user.divisi;
        } else if (divisionCode) {
            // KETUA can filter by division
            where.divisionCode = divisionCode;
        }

        // Active status filter
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        // Search filter (by name or NIM)
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { nim: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Get staff list with division info
        const [staff, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    division: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    }
                },
                orderBy: {
                    name: 'asc'
                },
                skip,
            }),
            prisma.user.count({ where })
        ]);

        // Map to desired response format
        const formattedStaff = staff.map(user => ({
            id: user.id,
            name: user.name,
            nim: user.nim,
            email: user.email,
            role: user.role,
            divisionCode: user.divisionCode,
            divisionName: user.division?.name || null,
            isActive: user.isActive,
            createdAt: user.createdAt
        }));

        res.json({
            success: true,
            data: formattedStaff,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get staff list error:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal mengambil data staff: ' + error.message
        });
    }
};

// 2. GET /api/staff/:nim - Get staff detail by NIM
exports.getStaffByNim = async (req, res) => {
    try {
        const { nim } = req.params;

        const user = await prisma.user.findUnique({
            where: { nim },
            include: {
                division: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Staff tidak ditemukan'
            });
        }

        // MANAJER can only view their own division
        if (req.user.role === 'MANAJER' && user.divisionCode !== req.user.divisi) {
            return res.status(403).json({
                success: false,
                error: 'Anda tidak memiliki izin untuk melihat staff dari divisi lain'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                nim: user.nim,
                email: user.email,
                role: user.role,
                divisionCode: user.divisionCode,
                divisionName: user.division?.name || null,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });

    } catch (error) {
        console.error('Get staff detail error:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal mengambil detail staff: ' + error.message
        });
    }
};

// 3. PUT /api/staff/:nim - Update staff (status, role, divisionCode)
exports.updateStaff = async (req, res) => {
    try {
        const { nim } = req.params;
        const { isActive, role, divisionCode } = req.body;

        // Find the staff to update
        const staff = await prisma.user.findUnique({
            where: { nim }
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                error: 'Staff tidak ditemukan'
            });
        }

        // Check authorization
        if (req.user.role === 'MANAJER') {
            // MANAJER can only update staff in their own division
            if (staff.divisionCode !== req.user.divisi) {
                return res.status(403).json({
                    success: false,
                    error: 'Anda tidak memiliki izin untuk mengubah staff dari divisi lain'
                });
            }
            // MANAJER can only update isActive status
            if (role || divisionCode) {
                return res.status(403).json({
                    success: false,
                    error: 'MANAJER hanya dapat mengubah status aktif/non-aktif'
                });
            }
        }

        // Build update data
        const updateData = {};
        if (isActive !== undefined) updateData.isActive = isActive;
        if (role !== undefined && req.user.role === 'KETUA') updateData.role = role;
        if (divisionCode !== undefined && req.user.role === 'KETUA') {
            // Verify division exists
            const division = await prisma.division.findUnique({
                where: { code: divisionCode }
            });
            if (!division) {
                return res.status(400).json({
                    success: false,
                    error: 'Divisi tidak ditemukan'
                });
            }
            updateData.divisionCode = divisionCode;
        }

        // Validate role enum
        if (updateData.role) {
            const validRoles = ['KETUA', 'MANAJER', 'STAFF', 'ADMIN'];
            if (!validRoles.includes(updateData.role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Role tidak valid'
                });
            }
        }

        // Update staff
        const updatedStaff = await prisma.user.update({
            where: { nim },
            data: updateData,
            include: {
                division: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'Staff berhasil diupdate',
            data: {
                id: updatedStaff.id,
                name: updatedStaff.name,
                nim: updatedStaff.nim,
                email: updatedStaff.email,
                role: updatedStaff.role,
                divisionCode: updatedStaff.divisionCode,
                divisionName: updatedStaff.division?.name || null,
                isActive: updatedStaff.isActive,
                updatedAt: updatedStaff.updatedAt
            }
        });

    } catch (error) {
        console.error('Update staff error:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal mengupdate staff: ' + error.message
        });
    }
};

// 4. DELETE /api/staff/:nim - Soft delete (set isActive=false)
exports.deleteStaff = async (req, res) => {
    try {
        const { nim } = req.params;

        // Find the staff to delete
        const staff = await prisma.user.findUnique({
            where: { nim }
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                error: 'Staff tidak ditemukan'
            });
        }

        // Check authorization
        if (req.user.role === 'MANAJER') {
            // MANAJER can only delete staff in their own division
            if (staff.divisionCode !== req.user.divisi) {
                return res.status(403).json({
                    success: false,
                    error: 'Anda tidak memiliki izin untuk menghapus staff dari divisi lain'
                });
            }
        }

        // Cannot delete yourself
        if (staff.nim === req.user.nim) {
            return res.status(400).json({
                success: false,
                error: 'Anda tidak dapat menghapus akun sendiri'
            });
        }

        // Soft delete - set isActive to false
        const deletedStaff = await prisma.user.update({
            where: { nim },
            data: { isActive: false },
            include: {
                division: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        res.json({
            success: true,
            data: {
                message: 'Staff berhasil dinonaktifkan'
            }
        });

    } catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal menonaktifkan staff: ' + error.message
        });
    }
};
