import express from 'express';
import pool from '../config/database.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit for session note files

// ─── Static routes first ──────────────────────────────────────────────────────

// POST /api/notes/upload-attachment - Upload a session note file (Enterprise only)
router.post('/upload-attachment', upload.single('file'), async (req, res) => {
    try {
        if (req.user.plan_name !== 'enterprise') {
            return res.status(403).json({ error: 'This feature is available for Enterprise plan users only.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const therapistId = req.user.id;
        const { appointment_id } = req.body;

        if (!appointment_id) {
            return res.status(400).json({ error: 'appointment_id is required' });
        }

        // Verify appointment belongs to this therapist
        const ownerCheck = await pool.query(
            'SELECT id FROM Appointments WHERE id = $1 AND therapist_id = $2',
            [appointment_id, therapistId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Appointment not found or access denied' });
        }

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'mellominds/session-notes',
                    public_id: `therapist_${therapistId}_appt_${appointment_id}_${Date.now()}`,
                    resource_type: 'auto',
                },
                (error, result) => { if (error) reject(error); else resolve(result); }
            );
            stream.end(req.file.buffer);
        });

        res.json({
            url: uploadResult.secure_url,
            original_name: req.file.originalname,
            resource_type: uploadResult.resource_type,
            format: uploadResult.format,
        });
    } catch (error) {
        console.error('Session note upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// GET /api/notes/template/me - Get therapist's note template
router.get('/template/me', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT fields FROM NoteTemplates WHERE therapist_id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.json({ fields: [
                { id: 1, label: 'Session Summary', type: 'textarea', key: 'session_summary', required: false },
                { id: 2, label: 'Client Mood', type: 'select', key: 'client_mood', required: false, options: ['Happy', 'Neutral', 'Anxious', 'Sad', 'Angry'] },
                { id: 3, label: 'Homework / Action Items', type: 'textarea', key: 'homework', required: false },
            ]});
        }
        res.json({ fields: result.rows[0].fields });
    } catch (error) {
        console.error('Error fetching note template:', error);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// POST /api/notes/template/me - Save therapist's note template
router.post('/template/me', async (req, res) => {
    try {
        const { fields } = req.body;
        if (!Array.isArray(fields)) return res.status(400).json({ error: 'fields must be an array' });

        await pool.query(
            `INSERT INTO NoteTemplates (therapist_id, fields, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (therapist_id)
             DO UPDATE SET fields = $2, updated_at = NOW()`,
            [req.user.id, JSON.stringify(fields)]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving note template:', error);
        res.status(500).json({ error: 'Failed to save template' });
    }
});

// POST /api/notes - Create a new note
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { appointment_id, content } = req.body;
        const therapist_id = req.user.id;

        if (!appointment_id || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify the appointment belongs to this therapist
        const ownerCheck = await client.query(
            'SELECT id FROM Appointments WHERE id = $1 AND therapist_id = $2',
            [appointment_id, therapist_id]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Appointment not found or access denied' });
        }

        const result = await client.query(
            `INSERT INTO SessionNotes (appointment_id, therapist_id, note_content)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [appointment_id, therapist_id, content]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).json({ error: 'Failed to add note' });
    } finally {
        client.release();
    }
});

// ─── Parameterized routes last ────────────────────────────────────────────────

// PUT /api/notes/:id - Edit an existing note
router.put('/:id', async (req, res) => {
    try {
        const { content } = req.body;
        const therapist_id = req.user.id;

        if (!content) return res.status(400).json({ error: 'Content is required' });

        const result = await pool.query(
            `UPDATE SessionNotes SET note_content = $1, updated_at = NOW()
             WHERE id = $2 AND therapist_id = $3 RETURNING *`,
            [content, req.params.id, therapist_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Failed to update note' });
    }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', async (req, res) => {
    try {
        const therapist_id = req.user.id;
        const result = await pool.query(
            'DELETE FROM SessionNotes WHERE id = $1 AND therapist_id = $2 RETURNING id',
            [req.params.id, therapist_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

// GET /api/notes/:appointmentId - Get notes for an appointment
router.get('/:appointmentId', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM SessionNotes 
             WHERE appointment_id = $1 AND therapist_id = $2
             ORDER BY created_at DESC`,
            [req.params.appointmentId, req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    } finally {
        client.release();
    }
});

export default router;
