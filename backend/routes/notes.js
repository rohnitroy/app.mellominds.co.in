import express from 'express';
import pool from '../config/database.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { getIO } from '../lib/socket.js';
import { encryptJSONB, decryptJSONB } from '../lib/encryption.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit for session note files

// Resolve note content: encrypted column first, then legacy plaintext columns
export const resolveNoteContent = (row, therapistId) => {
    if (row.note_content_encrypted) {
        const decrypted = decryptJSONB(row.note_content_encrypted, therapistId);
        if (decrypted !== null) return decrypted;
    }
    if (row.note_content !== null && row.note_content !== undefined) return row.note_content;
    if (row.content !== null && row.content !== undefined) {
        try { return JSON.parse(row.content); } catch { return row.content; }
    }
    return null;
};

const toClientNote = (row, therapistId) => ({
    id: row.id,
    appointment_id: row.appointment_id,
    therapist_id: row.therapist_id,
    content: resolveNoteContent(row, therapistId),
    attachments: row.attachments || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
});

// Best-effort delete of Cloudinary attachments (never blocks the response)
const destroyAttachments = async (attachments) => {
    if (!Array.isArray(attachments)) return;
    for (const a of attachments) {
        if (!a?.public_id) continue;
        try {
            await cloudinary.uploader.destroy(a.public_id, { resource_type: a.resource_type === 'raw' ? 'raw' : 'image' });
        } catch (err) {
            console.error('Failed to delete Cloudinary attachment:', a.public_id, err.message);
        }
    }
};

// ─── Static routes first ──────────────────────────────────────────────────────

// POST /api/notes/upload-attachment - Upload a session note file (Individual & Team plans)
router.post('/upload-attachment', upload.single('file'), async (req, res) => {
    try {
        if (req.user.plan_name !== 'team' && req.user.plan_name !== 'individual') {
            return res.status(403).json({ error: 'This feature is available for Individual and Team plan users.' });
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

        const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
        const isImage = req.file.mimetype.startsWith('image/');

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'mellominds/session-notes',
                    public_id: `therapist_${therapistId}_appt_${appointment_id}_${Date.now()}`,
                    resource_type: (isPdf || isImage) ? 'image' : 'raw',
                    ...(isPdf && { format: 'pdf', flags: 'attachment:false' }),
                },
                (error, result) => { if (error) reject(error); else resolve(result); }
            );
            stream.end(req.file.buffer);
        });

        const finalUrl = uploadResult.resource_type === 'raw'
            ? uploadResult.secure_url.replace('/raw/upload/', '/raw/upload/fl_attachment:false/')
            : uploadResult.secure_url;

        res.json({
            url: finalUrl,
            original_name: req.file.originalname,
            public_id: uploadResult.public_id,
            resource_type: uploadResult.resource_type,
            format: uploadResult.format,
        });
    } catch (error) {
        console.error('Session note upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// POST /api/notes/delete-attachment - Remove an uploaded file that was never saved with a note
router.post('/delete-attachment', async (req, res) => {
    try {
        const { public_id, resource_type } = req.body;
        if (!public_id) return res.status(400).json({ error: 'public_id is required' });

        // Only allow deleting files this therapist uploaded (public_id carries the owner prefix)
        const ownPrefix = `mellominds/session-notes/therapist_${req.user.id}_`;
        if (!public_id.startsWith(ownPrefix)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await cloudinary.uploader.destroy(public_id, { resource_type: resource_type === 'raw' ? 'raw' : 'image' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting attachment:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
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

        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('notes_template_updated');

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
        const { appointment_id, content, attachments } = req.body;
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

        const safeAttachments = Array.isArray(attachments) ? attachments : [];
        const encryptedContent = encryptJSONB(content, therapist_id);

        const result = await client.query(
            `INSERT INTO SessionNotes (appointment_id, therapist_id, note_content_encrypted, attachments)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [appointment_id, therapist_id, encryptedContent, JSON.stringify(safeAttachments)]
        );

        // Auto-complete the appointment if it's still 'scheduled' and the session has ended
        // This handles the "pending_notes" → "completed" transition
        await client.query(
            `UPDATE Appointments
             SET status = 'completed'
             WHERE id = $1
               AND therapist_id = $2
               AND status = 'scheduled'
               AND end_time < NOW()`,
            [appointment_id, therapist_id]
        );

        res.status(201).json(toClientNote(result.rows[0], therapist_id));
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
        const { content, attachments } = req.body;
        const therapist_id = req.user.id;

        if (!content) return res.status(400).json({ error: 'Content is required' });

        const safeAttachments = Array.isArray(attachments) ? attachments : undefined;
        const encryptedContent = encryptJSONB(content, therapist_id);

        const result = await pool.query(
            `UPDATE SessionNotes
             SET note_content_encrypted = $1,
                 note_content = NULL,
                 content = NULL,
                 attachments = COALESCE($2::jsonb, attachments),
                 updated_at = NOW()
             WHERE id = $3 AND therapist_id = $4 RETURNING *`,
            [encryptedContent, safeAttachments ? JSON.stringify(safeAttachments) : null, req.params.id, therapist_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        res.json(toClientNote(result.rows[0], therapist_id));
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Failed to update note' });
    }
});

// DELETE /api/notes/:id - Delete a note (and its Cloudinary attachments)
router.delete('/:id', async (req, res) => {
    try {
        const therapist_id = req.user.id;
        const result = await pool.query(
            'DELETE FROM SessionNotes WHERE id = $1 AND therapist_id = $2 RETURNING id, attachments',
            [req.params.id, therapist_id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });

        // Clean up attached files in Cloudinary (best effort, non-blocking for the client)
        destroyAttachments(result.rows[0].attachments);

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
        res.json(result.rows.map(row => toClientNote(row, req.user.id)));
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    } finally {
        client.release();
    }
});

export default router;
