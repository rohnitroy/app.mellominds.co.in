// ============================================================================
// MISSING BOOKINGS ENDPOINTS - Add these to bookings.js
// ============================================================================

import express from 'express';
import pool from '../config/database.js';
import { createNotification } from '../lib/notifications.js';
import { sendEmail, bookingConfirmationEmail, cancellationEmail, rescheduleConfirmationEmail, isEmailEnabled } from '../lib/email.js';
import { getGoogleAuthClient } from '../lib/googleAuth.js';
import { getIO } from '../lib/socket.js';

const router = express.Router();

// Middleware to ensure authentication
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// ============================================================================
// GET /api/bookings - Get all appointments for authenticated therapist
// ============================================================================
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const { email } = req.query;
        const therapistId = req.user.id;

        let query = `
            SELECT id, calendar_id, therapist_id, client_email, client_name, client_phone,
                   start_time, end_time, status, payment_status, payment_amount,
                   location_type, form_responses, created_at, updated_at
            FROM Appointments
            WHERE therapist_id = $1
        `;
        const params = [therapistId];

        // Filter by client email if provided
        if (email) {
            query += ` AND LOWER(client_email) = LOWER($2)`;
            params.push(email);
        }

        query += ` ORDER BY start_time DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

// ============================================================================
// PATCH /api/bookings/:id/status - Update appointment status
// ============================================================================
router.patch('/:id/status', ensureAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const appointmentId = parseInt(req.params.id);
        const { status } = req.body;
        const therapistId = req.user.id;

        // Validate status
        const validStatuses = ['scheduled', 'completed', 'cancelled', 'noshow'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Verify ownership
        const apptRes = await client.query(
            'SELECT * FROM Appointments WHERE id = $1 AND therapist_id = $2',
            [appointmentId, therapistId]
        );

        if (apptRes.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = apptRes.rows[0];

        await client.query('BEGIN');

        // Update appointment status
        const updateRes = await client.query(
            `UPDATE Appointments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, appointmentId]
        );

        // Create notification
        await createNotification(therapistId, 'appointment_status_changed', 
            `Appointment status changed to ${status}`, 
            `Appointment with ${appointment.client_name} is now ${status}`, 
            appointmentId);

        // Emit real-time update
        const io = getIO();
        io.to(`user:${therapistId}`).emit('bookings_updated', { appointmentId, status });

        await client.query('COMMIT');

        res.json({ message: 'Appointment status updated', appointment: updateRes.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating appointment status:', error);
        res.status(500).json({ error: 'Failed to update appointment status' });
    } finally {
        client.release();
    }
});

// ============================================================================
// PATCH /api/bookings/:id/payment - Update payment status
// ============================================================================
router.patch('/:id/payment', ensureAuthenticated, async (req, res) => {
    try {
        const appointmentId = parseInt(req.params.id);
        const { payment_status, payment_amount } = req.body;
        const therapistId = req.user.id;

        // Validate payment status
        const validStatuses = ['pending', 'paid', 'failed', 'refunded', 'partial_refund'];
        if (!validStatuses.includes(payment_status)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }

        // Verify ownership
        const apptRes = await pool.query(
            'SELECT * FROM Appointments WHERE id = $1 AND therapist_id = $2',
            [appointmentId, therapistId]
        );

        if (apptRes.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Update payment status
        const updateRes = await pool.query(
            `UPDATE Appointments SET payment_status = $1, payment_amount = $2, updated_at = NOW() 
             WHERE id = $3 RETURNING *`,
            [payment_status, payment_amount || null, appointmentId]
        );

        // Create notification
        await createNotification(therapistId, 'payment_status_changed', 
            `Payment status changed to ${payment_status}`, 
            `Payment for appointment is now ${payment_status}`, 
            appointmentId);

        res.json({ message: 'Payment status updated', appointment: updateRes.rows[0] });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

// ============================================================================
// POST /api/bookings/:id/reminder - Send appointment reminder
// ============================================================================
router.post('/:id/reminder', ensureAuthenticated, async (req, res) => {
    try {
        const appointmentId = parseInt(req.params.id);
        const therapistId = req.user.id;

        // Fetch appointment
        const apptRes = await pool.query(
            'SELECT * FROM Appointments WHERE id = $1 AND therapist_id = $2',
            [appointmentId, therapistId]
        );

        if (apptRes.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = apptRes.rows[0];

        // Send reminder email
        if (await isEmailEnabled(therapistId, 'appointment_reminder')) {
            const reminderEmail = {
                subject: `Reminder: Your appointment with ${appointment.client_name}`,
                html: `
                    <p>Hi ${appointment.client_name},</p>
                    <p>This is a reminder about your upcoming appointment.</p>
                    <p><strong>Date & Time:</strong> ${new Date(appointment.start_time).toLocaleString()}</p>
                    <p>Please arrive 5 minutes early.</p>
                `
            };
            await sendEmail({ to: appointment.client_email, ...reminderEmail });
        }

        // Create notification
        await createNotification(therapistId, 'reminder_sent', 
            'Appointment reminder sent', 
            `Reminder sent to ${appointment.client_name}`, 
            appointmentId);

        res.json({ message: 'Reminder sent successfully' });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ error: 'Failed to send reminder' });
    }
});

// ============================================================================
// PATCH /api/bookings/:id/reschedule - Reschedule appointment
// ============================================================================
router.patch('/:id/reschedule', ensureAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const appointmentId = parseInt(req.params.id);
        const { new_start_time } = req.body;
        const therapistId = req.user.id;

        if (!new_start_time) {
            return res.status(400).json({ error: 'New start time is required' });
        }

        // Verify ownership
        const apptRes = await client.query(
            'SELECT * FROM Appointments WHERE id = $1 AND therapist_id = $2',
            [appointmentId, therapistId]
        );

        if (apptRes.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = apptRes.rows[0];
        const oldStartTime = appointment.start_time;

        await client.query('BEGIN');

        // Calculate new end time based on calendar duration
        const calendarRes = await client.query(
            'SELECT duration FROM Calendars WHERE id = $1',
            [appointment.calendar_id]
        );

        const duration = calendarRes.rows[0]?.duration || 60;
        const newStartDate = new Date(new_start_time);
        const newEndDate = new Date(newStartDate.getTime() + duration * 60000);

        // Update appointment
        const updateRes = await client.query(
            `UPDATE Appointments SET start_time = $1, end_time = $2, updated_at = NOW() 
             WHERE id = $3 RETURNING *`,
            [new_start_time, newEndDate.toISOString(), appointmentId]
        );

        // Update Google Calendar event if integrated
        try {
            const integrationRes = await client.query(
                'SELECT access_token, calendar_id FROM UserIntegrations WHERE user_id = $1 AND provider = $2',
                [therapistId, 'google']
            );

            if (integrationRes.rows.length > 0) {
                const { access_token, calendar_id } = integrationRes.rows[0];
                const authClient = getGoogleAuthClient();
                authClient.setCredentials({ access_token });

                const calendar = google.calendar({ version: 'v3', auth: authClient });
                
                // Find and update the event
                const events = await calendar.events.list({
                    calendarId: calendar_id,
                    q: `${appointment.client_name} ${appointment.client_email}`,
                    maxResults: 1
                });

                if (events.data.items.length > 0) {
                    const eventId = events.data.items[0].id;
                    await calendar.events.update({
                        calendarId: calendar_id,
                        eventId: eventId,
                        requestBody: {
                            start: { dateTime: new_start_time },
                            end: { dateTime: newEndDate.toISOString() }
                        }
                    });
                }
            }
        } catch (calendarError) {
            console.error('Error updating Google Calendar:', calendarError);
            // Continue even if calendar update fails
        }

        // Send reschedule email
        if (await isEmailEnabled(therapistId, 'appointment_rescheduled')) {
            const emailContent = rescheduleConfirmationEmail({
                clientName: appointment.client_name,
                oldDateTime: new Date(oldStartTime).toLocaleString(),
                newDateTime: new Date(new_start_time).toLocaleString()
            });
            await sendEmail({ to: appointment.client_email, ...emailContent });
        }

        // Create notification
        await createNotification(therapistId, 'appointment_rescheduled', 
            'Appointment rescheduled', 
            `Appointment with ${appointment.client_name} rescheduled to ${new Date(new_start_time).toLocaleString()}`, 
            appointmentId);

        // Emit real-time update
        const io = getIO();
        io.to(`user:${therapistId}`).emit('bookings_updated', { appointmentId, new_start_time });

        await client.query('COMMIT');

        res.json({ message: 'Appointment rescheduled successfully', appointment: updateRes.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error rescheduling appointment:', error);
        res.status(500).json({ error: 'Failed to reschedule appointment' });
    } finally {
        client.release();
    }
});

// ============================================================================
// GET /api/bookings/stats - Get booking statistics
// ============================================================================
router.get('/stats', ensureAuthenticated, async (req, res) => {
    try {
        const therapistId = req.user.id;
        const { startDate, endDate } = req.query;

        let query = `
            SELECT 
                COUNT(*) as total_appointments,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                COUNT(CASE WHEN status = 'noshow' THEN 1 END) as noshow,
                COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_appointments,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN payment_amount ELSE 0 END), 0) as total_revenue
            FROM Appointments
            WHERE therapist_id = $1
        `;
        const params = [therapistId];

        if (startDate && endDate) {
            query += ` AND start_time BETWEEN $2 AND $3`;
            params.push(startDate, endDate);
        }

        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching booking stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;
