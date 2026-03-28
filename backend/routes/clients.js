import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Middleware to ensure authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

// POST /api/clients - Create a new client manually
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            name, phone, email,
            age, occupation, gender, maritalStatus,
            emergencyName, emergencyPhone, emergencyRelation
        } = req.body;

        if (!name || !name.trim() || !email || !email.trim()) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const result = await pool.query(
            `INSERT INTO Clients 
                (therapist_id, name, email, phone, age, occupation, gender, marital_status, emergency_name, emergency_phone, emergency_relation)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (therapist_id, email) DO NOTHING
             RETURNING *`,
            [
                userId,
                name.trim(),
                email.trim().toLowerCase(),
                phone || null,
                age || null,
                occupation || null,
                gender || null,
                maritalStatus || null,
                emergencyName || null,
                emergencyPhone || null,
                emergencyRelation || null
            ]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'A client with this email already exists' });
        }

        const row = result.rows[0];
        res.status(201).json({
            id: row.id,
            name: row.name,
            phone: row.phone || '',
            email: row.email,
            sessions: '0',
            revenue: '₹0',
            lastSession: '—',
            age: row.age || '',
            occupation: row.occupation || '',
            gender: row.gender || 'Male',
            maritalStatus: row.marital_status || 'Single',
            emergencyName: row.emergency_name || '',
            emergencyPhone: row.emergency_phone || '',
            emergencyRelation: row.emergency_relation || ''
        });

    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: error.message || 'Failed to create client' });
    }
});

// PUT /api/clients/:id - Update client details
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const clientId = parseInt(req.params.id);
        const {
            name, phone, email,
            age, occupation, gender, maritalStatus,
            emergencyName, emergencyPhone, emergencyRelation
        } = req.body;

        // Check if client exists and belongs to therapist
        const checkRes = await pool.query(
            'SELECT id FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, userId]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const result = await pool.query(
            `UPDATE Clients 
            SET 
                name = COALESCE($1, name),
                phone = COALESCE($2, phone),
                email = COALESCE($3, email),
                age = COALESCE($4, age),
                occupation = COALESCE($5, occupation),
                gender = COALESCE($6, gender),
                marital_status = COALESCE($7, marital_status),
                emergency_name = COALESCE($8, emergency_name),
                emergency_phone = COALESCE($9, emergency_phone),
                emergency_relation = COALESCE($10, emergency_relation),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $11 AND therapist_id = $12
            RETURNING *`,
            [
                name, phone, email,
                age, occupation, gender, maritalStatus,
                emergencyName, emergencyPhone, emergencyRelation,
                clientId, userId
            ]
        );

        const row = result.rows[0];
        res.json({
            id: row.id,
            name: row.name,
            phone: row.phone,
            email: row.email,
            age: row.age,
            occupation: row.occupation,
            gender: row.gender,
            maritalStatus: row.marital_status,
            emergencyName: row.emergency_name,
            emergencyPhone: row.emergency_phone,
            emergencyRelation: row.emergency_relation
        });

    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: error.message || 'Failed to update client' });
    }
});

export default router;
