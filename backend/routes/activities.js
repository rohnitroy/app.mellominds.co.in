import express from 'express';
import pool from '../config/database.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { sendEmail, activityNotificationEmail, isEmailEnabled } from '../lib/email.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit for activity resources

// Best-effort delete of Cloudinary attachments (never blocks the response)
const destroyAttachments = async (attachments) => {
    if (!Array.isArray(attachments)) return;
    for (const a of attachments) {
        if (!a?.public_id) continue;
        try {
            await cloudinary.uploader.destroy(a.public_id, { resource_type: a.resource_type === 'raw' ? 'raw' : 'image' });
        } catch (err) {
            console.error('Failed to delete Cloudinary resource:', a.public_id, err.message);
        }
    }
};

// POST /api/activities/upload-resource - Upload a resource file (Individual & Team plans)
router.post('/upload-resource', upload.single('file'), async (req, res) => {
    try {
        if (req.user.plan_name !== 'team' && req.user.plan_name !== 'individual') {
            return res.status(403).json({ error: 'Resource attachments are available for Individual and Team plan users.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const therapistId = req.user.id;
        const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
        const isImage = req.file.mimetype.startsWith('image/');

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'mellominds/activity-resources',
                    public_id: `therapist_${therapistId}_${Date.now()}`,
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
        });
    } catch (error) {
        console.error('Activity resource upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// POST /api/activities/delete-resource - Remove an uploaded file that was never saved with an activity
router.post('/delete-resource', async (req, res) => {
    try {
        const { public_id, resource_type } = req.body;
        if (!public_id) return res.status(400).json({ error: 'public_id is required' });

        const ownPrefix = `mellominds/activity-resources/therapist_${req.user.id}_`;
        if (!public_id.startsWith(ownPrefix)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await cloudinary.uploader.destroy(public_id, { resource_type: resource_type === 'raw' ? 'raw' : 'image' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting resource:', error);
        res.status(500).json({ error: 'Failed to delete resource' });
    }
});

// GET /api/activities/:clientId
router.get('/:clientId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM ClientActivities WHERE client_id = $1 AND therapist_id = $2 ORDER BY created_at DESC`,
            [req.params.clientId, req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// POST /api/activities
router.post('/', async (req, res) => {
    try {
        const { client_id, name, description, notify_client, reminder_count, reminder_interval_days,
                exercise_type, purpose, due_date, attachments } = req.body;
        if (!client_id || !name) {
            return res.status(400).json({ error: 'client_id and name are required' });
        }

        const safeAttachments = Array.isArray(attachments) ? attachments : [];
        const safeDueDate = due_date || null;

        const shouldNotify = !!notify_client;

        // Plan check: only Individual and Team plans can create reminders
        if (shouldNotify && req.user.plan_name === 'free') {
            return res.status(403).json({ error: 'Reminder scheduling requires Individual or Team plan.' });
        }
        const count = shouldNotify ? Math.max(1, parseInt(reminder_count) || 1) : 0;
        const intervalDays = shouldNotify ? Math.max(1, parseInt(reminder_interval_days) || 1) : 1;

        // Calculate first reminder time (interval days from now)
        const nextReminderAt = shouldNotify && count > 0
            ? new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000)
            : null;

        const result = await pool.query(
            `INSERT INTO ClientActivities
                (client_id, therapist_id, name, description, notify_client, reminder_count, reminder_interval_days, reminders_sent, next_reminder_at,
                 exercise_type, purpose, due_date, attachments)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, $12) RETURNING *`,
            [client_id, req.user.id, name, description || null, shouldNotify, count, intervalDays, nextReminderAt,
             exercise_type || null, purpose || null, safeDueDate, JSON.stringify(safeAttachments)]
        );

        res.status(201).json(result.rows[0]);

        // Send immediate notification email (fire-and-forget)
        if (shouldNotify) {
            sendImmediateActivityEmail(client_id, req.user.id, name, description).catch(() => {});
        }

    } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({ error: 'Failed to create activity' });
    }
});

// DELETE /api/activities/:id
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM ClientActivities WHERE id = $1 AND therapist_id = $2 RETURNING id, attachments`,
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Activity not found' });

        // Clean up attached files in Cloudinary (best effort)
        destroyAttachments(result.rows[0].attachments);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ error: 'Failed to delete activity' });
    }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendImmediateActivityEmail(clientId, therapistId, activityName, activityDescription) {
    try {
        if (!await isEmailEnabled(therapistId, 'activity_notification')) {
            console.log(`⚠️ Activity notification email disabled for therapist ${therapistId}`);
            return;
        }
        const clientRes = await pool.query(
            'SELECT name, email FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, therapistId]
        );
        if (!clientRes.rows.length || !clientRes.rows[0].email) {
            console.warn(`⚠️ Client ${clientId} not found or has no email`);
            return;
        }

        const therapistRes = await pool.query('SELECT user_name FROM Users WHERE id = $1', [therapistId]);
        const therapistName = therapistRes.rows[0]?.user_name || 'Your therapist';
        const client = clientRes.rows[0];

        const emailContent = activityNotificationEmail({
            clientName: client.name,
            therapistName,
            activityName,
            activityDescription,
            isReminder: false
        });
        await sendEmail({ to: client.email, ...emailContent, senderId: therapistId });
        console.log(`✅ Activity notification email sent to client: ${client.email}`);
    } catch (err) {
        console.error(`❌ Failed to send activity notification email for client ${clientId}:`, err.message);
    }
}

export default router;
