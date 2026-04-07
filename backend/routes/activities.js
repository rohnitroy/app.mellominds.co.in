import express from 'express';
import pool from '../config/database.js';
import { sendEmail, activityNotificationEmail, isEmailEnabled } from '../lib/email.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

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
        const { client_id, name, description, notify_client, reminder_count, reminder_interval_days } = req.body;
        if (!client_id || !name) {
            return res.status(400).json({ error: 'client_id and name are required' });
        }

        const shouldNotify = !!notify_client;
        const count = shouldNotify ? Math.max(1, parseInt(reminder_count) || 1) : 0;
        const intervalDays = shouldNotify ? Math.max(1, parseInt(reminder_interval_days) || 1) : 1;

        // Calculate first reminder time (interval days from now)
        const nextReminderAt = shouldNotify && count > 0
            ? new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000)
            : null;

        const result = await pool.query(
            `INSERT INTO ClientActivities
                (client_id, therapist_id, name, description, notify_client, reminder_count, reminder_interval_days, reminders_sent, next_reminder_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8) RETURNING *`,
            [client_id, req.user.id, name, description || null, shouldNotify, count, intervalDays, nextReminderAt]
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
            `DELETE FROM ClientActivities WHERE id = $1 AND therapist_id = $2 RETURNING id`,
            [req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Activity not found' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ error: 'Failed to delete activity' });
    }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendImmediateActivityEmail(clientId, therapistId, activityName, activityDescription) {
    if (!await isEmailEnabled(therapistId, 'activity_notification')) return;
    const clientRes = await pool.query(
        'SELECT name, email FROM Clients WHERE id = $1 AND therapist_id = $2',
        [clientId, therapistId]
    );
    if (!clientRes.rows.length || !clientRes.rows[0].email) return;

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
    await sendEmail({ to: client.email, ...emailContent });
}

export default router;
