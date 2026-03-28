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

// GET /api/clients/lookup-therapist?email=... - Check if a therapist email exists
router.get('/lookup-therapist', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const result = await pool.query(
            'SELECT id, user_name FROM Users WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ exists: false, error: 'No therapist found with this email' });
        }

        // Don't expose the ID — just confirm existence and return display name
        res.json({ exists: true, name: result.rows[0].user_name });
    } catch (err) {
        console.error('Lookup error:', err);
        res.status(500).json({ error: 'Lookup failed' });
    }
});
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
                (therapist_id, name, email, phone, age, occupation, gender, marital_status, emergency_name, emergency_phone, emergency_relation, manually_added)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
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
            emergencyRelation: row.emergency_relation || '',
            manually_added: true
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

// POST /api/clients/:id/transfer - Transfer client to another therapist by email
router.post('/:id/transfer', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const fromTherapistId = req.user.id;
        const clientId = parseInt(req.params.id);
        const { target_email, transfer_options } = req.body;
        // transfer_options: { profile: bool, appointments: bool, notes: bool, activities: bool }

        if (!target_email) {
            return res.status(400).json({ error: 'Target therapist email is required' });
        }

        // 1. Verify client belongs to this therapist
        const clientRes = await dbClient.query(
            'SELECT * FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, fromTherapistId]
        );
        if (clientRes.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // 2. Find target therapist by email (must be a registered user)
        const targetRes = await dbClient.query(
            'SELECT id, user_name, email FROM Users WHERE LOWER(email) = LOWER($1)',
            [target_email.trim()]
        );
        if (targetRes.rows.length === 0) {
            return res.status(404).json({ error: 'No therapist found with that email address' });
        }

        const toTherapistId = targetRes.rows[0].id;

        if (toTherapistId === fromTherapistId) {
            return res.status(400).json({ error: 'Cannot transfer to yourself' });
        }

        const opts = {
            profile: true, // always transfer profile
            appointments: transfer_options?.appointments ?? false,
            notes: transfer_options?.notes ?? false,
            activities: transfer_options?.activities ?? false,
        };

        await dbClient.query('BEGIN');

        // 3. Transfer client profile — upsert into target therapist
        const existingClient = await dbClient.query(
            'SELECT id FROM Clients WHERE therapist_id = $1 AND email = $2',
            [toTherapistId, clientRes.rows[0].email]
        );

        let newClientId;
        if (existingClient.rows.length > 0) {
            // Update existing record
            newClientId = existingClient.rows[0].id;
            await dbClient.query(
                `UPDATE Clients SET name=$1, phone=$2, age=$3, occupation=$4, gender=$5,
                 marital_status=$6, emergency_name=$7, emergency_phone=$8, emergency_relation=$9,
                 updated_at=CURRENT_TIMESTAMP
                 WHERE id=$10`,
                [
                    clientRes.rows[0].name, clientRes.rows[0].phone, clientRes.rows[0].age,
                    clientRes.rows[0].occupation, clientRes.rows[0].gender, clientRes.rows[0].marital_status,
                    clientRes.rows[0].emergency_name, clientRes.rows[0].emergency_phone,
                    clientRes.rows[0].emergency_relation, newClientId
                ]
            );
        } else {
            const insertRes = await dbClient.query(
                `INSERT INTO Clients (therapist_id, name, email, phone, age, occupation, gender,
                 marital_status, emergency_name, emergency_phone, emergency_relation, manually_added)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true) RETURNING id`,
                [
                    toTherapistId, clientRes.rows[0].name, clientRes.rows[0].email,
                    clientRes.rows[0].phone, clientRes.rows[0].age, clientRes.rows[0].occupation,
                    clientRes.rows[0].gender, clientRes.rows[0].marital_status,
                    clientRes.rows[0].emergency_name, clientRes.rows[0].emergency_phone,
                    clientRes.rows[0].emergency_relation
                ]
            );
            newClientId = insertRes.rows[0].id;
        }

        // 4. Transfer appointments (future only — past stays with original therapist)
        if (opts.appointments) {
            await dbClient.query(
                `UPDATE Appointments SET therapist_id = $1
                 WHERE therapist_id = $2 AND client_email = $3 AND start_time > NOW() AND status != 'cancelled'`,
                [toTherapistId, fromTherapistId, clientRes.rows[0].email]
            );
        }

        // 5. Transfer session notes (only for transferred appointments)
        if (opts.notes && opts.appointments) {
            await dbClient.query(
                `UPDATE SessionNotes SET therapist_id = $1
                 WHERE therapist_id = $2 AND appointment_id IN (
                     SELECT id FROM Appointments WHERE therapist_id = $1 AND client_email = $3
                 )`,
                [toTherapistId, fromTherapistId, clientRes.rows[0].email]
            );
        }

        // 6. Transfer activities
        if (opts.activities) {
            await dbClient.query(
                `UPDATE ClientActivities SET therapist_id = $1
                 WHERE therapist_id = $2 AND client_id = $3`,
                [toTherapistId, fromTherapistId, clientId]
            );
        }

        await dbClient.query('COMMIT');

        res.json({
            message: `Client successfully transferred to ${targetRes.rows[0].user_name || target_email}`,
            transferred_to: targetRes.rows[0].user_name || target_email
        });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Error transferring client:', error);
        res.status(500).json({ error: 'Failed to transfer client' });
    } finally {
        dbClient.release();
    }
});

// DELETE /api/clients/:id - Delete a client (only manually added clients)
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const clientId = parseInt(req.params.id);

        // Only allow deletion of manually added clients
        const check = await pool.query(
            'SELECT manually_added FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, userId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        if (!check.rows[0].manually_added) {
            return res.status(403).json({ error: 'Only manually added clients can be deleted' });
        }

        await pool.query('DELETE FROM Clients WHERE id = $1 AND therapist_id = $2', [clientId, userId]);
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});
