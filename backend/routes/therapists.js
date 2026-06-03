import express from 'express';
import pool from '../config/database.js';
import { sendEmail } from '../lib/email.js';
import { isValidEmail } from '../middleware/sanitize.js';
import { getIO } from '../lib/socket.js';
import crypto from 'crypto';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

// Team owner = plan_name 'team' AND org_role is NULL or 'owner'
// (members have plan_name 'team' too but org_role = 'member')
const ensureEnterpriseOwner = (req, res, next) => {
    if (req.user?.plan_name === 'team' && req.user?.org_role !== 'member') return next();
    res.status(403).json({ error: 'This feature is available to Enterprise plan owners only.' });
};

// ─── PUBLIC ENDPOINTS (no authentication) ────────────────────────────────────
// ─── GET /api/therapists/validate-invite ────────────────────────────────────
router.get('/validate-invite', async (req, res) => {
    const { token, email } = req.query;

    if (!token || !email) {
        return res.status(400).json({ valid: false, error: 'Token and email are required.' });
    }

    try {
        const result = await pool.query(
            `SELECT id, status, invite_expires_at FROM organization_therapists
             WHERE invite_token = $1 AND LOWER(invite_email) = $2 AND status = 'pending' AND invite_expires_at > NOW()`,
            [token.trim(), email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.json({ valid: false, error: 'Invitation not found or has expired.' });
        }

        return res.json({ valid: true });
    } catch (err) {
        console.error('GET /api/therapists/validate-invite error:', err.message);
        res.status(500).json({ valid: false, error: 'Failed to validate invitation.' });
    }
});

// ─── AUTHENTICATED ENDPOINTS (require auth + enterprise owner) ───────────────
router.use(ensureAuthenticated);
router.use(ensureEnterpriseOwner);

// ─── GET /api/therapists/:id/profile ─────────────────────────────────────────
router.get('/:id/profile', async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) return res.status(400).json({ error: 'Invalid ID.' });

    try {
        const memberCheck = await pool.query(
            `SELECT ot.therapist_user_id, ot.invite_email, ot.status, ot.created_at
             FROM organization_therapists ot
             WHERE ot.id = $1 AND ot.owner_id = $2`,
            [id, req.user.id]
        );
        if (memberCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Therapist not found in your team.' });
        }

        const member = memberCheck.rows[0];
        const therapistUserId = member.therapist_user_id;

        if (!therapistUserId) {
            return res.json({
                info: {
                    id: Number(id), therapist_user_id: null,
                    invite_email: member.invite_email, status: member.status,
                    created_at: member.created_at, user_name: null,
                    email: member.invite_email, specializations: null,
                    profile_picture: null, calendar_count: 0, calendars: [],
                },
                analytics: { revenue: 0, sessions: 0, bookings: 0, cancelled: 0, clients: 0 },
                clients: [],
                recentBookings: [],
            });
        }

        const infoRes = await pool.query(
            `SELECT u.id, u.user_name, u.email, u.specialization AS specializations, u.profile_picture,
                    COUNT(c.id) AS calendar_count,
                    COALESCE(
                        json_agg(json_build_object('id', c.id, 'title', c.title) ORDER BY c.created_at DESC)
                        FILTER (WHERE c.id IS NOT NULL), '[]'
                    ) AS calendars
             FROM Users u
             LEFT JOIN Calendars c ON c.user_id = u.id
             WHERE u.id = $1
             GROUP BY u.id`,
            [therapistUserId]
        );
        const info = infoRes.rows[0] || {};

        const analyticsRes = await pool.query(
            `SELECT
                COUNT(*) AS bookings,
                COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS sessions,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                COALESCE(SUM(payment_amount) FILTER (
                    WHERE payment_status IN ('Paid','Partial Refund') AND status != 'cancelled'
                ), 0) AS revenue
             FROM Appointments WHERE therapist_id = $1`,
            [therapistUserId]
        );
        const clientCountRes = await pool.query(
            `SELECT COUNT(*) AS clients FROM Clients WHERE therapist_id = $1`,
            [therapistUserId]
        );
        const a = analyticsRes.rows[0];

        const clientsRes = await pool.query(
            `SELECT c.id, c.name, c.email, c.phone, c.gender
             FROM Clients c WHERE c.therapist_id = $1 ORDER BY c.name ASC`,
            [therapistUserId]
        );

        const bookingsRes = await pool.query(
            `SELECT a.id, a.client_name, a.client_email, a.start_time, a.status,
                    cal.title AS calendar_title
             FROM Appointments a
             LEFT JOIN Calendars cal ON cal.id = a.calendar_id
             WHERE a.therapist_id = $1
             ORDER BY a.start_time DESC LIMIT 50`,
            [therapistUserId]
        );

        // Convert specialization string to array format
        const specializations = info.specializations ? [info.specializations] : null;

        res.json({
            info: {
                ...info, id: Number(id),
                specializations: specializations,
                status: member.status, created_at: member.created_at,
                calendar_count: parseInt(info.calendar_count || 0),
            },
            analytics: {
                revenue: parseFloat(a.revenue || 0),
                sessions: parseInt(a.sessions || 0),
                bookings: parseInt(a.bookings || 0),
                cancelled: parseInt(a.cancelled || 0),
                clients: parseInt(clientCountRes.rows[0].clients || 0),
            },
            clients: clientsRes.rows,
            recentBookings: bookingsRes.rows,
        });
    } catch (err) {
        console.error('GET /api/therapists/:id/profile error:', err.message);
        res.status(500).json({ error: 'Failed to fetch therapist profile.' });
    }
});

// ─── GET /api/therapists ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                ot.id, ot.therapist_user_id, ot.invite_email, ot.status, ot.created_at,
                u.user_name, u.email, u.specialization AS specializations, u.profile_picture, u.phone,
                COUNT(c.id) AS calendar_count
             FROM organization_therapists ot
             LEFT JOIN Users u ON ot.therapist_user_id = u.id
             LEFT JOIN Calendars c ON c.user_id = ot.therapist_user_id
             WHERE ot.owner_id = $1
             GROUP BY ot.id, ot.therapist_user_id, ot.invite_email, ot.status, ot.created_at,
                      u.user_name, u.email, u.specialization, u.profile_picture, u.phone
             ORDER BY ot.created_at DESC`,
            [req.user.id]
        );
        // Convert specialization string to array format
        const therapists = result.rows.map(t => ({
            ...t,
            specializations: t.specializations ? [t.specializations] : null
        }));
        res.json(therapists);
    } catch (err) {
        console.error('GET /api/therapists error:', err.message);
        res.status(500).json({ error: 'Failed to fetch therapists.' });
    }
});

// ─── POST /api/therapists/invite ─────────────────────────────────────────────
router.post('/invite', async (req, res) => {
    let { email } = req.body;
    email = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';

    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (email === req.user.email.toLowerCase()) {
        return res.status(400).json({ error: 'You cannot invite yourself.' });
    }

    try {
        // Check available seats (owner counts as 1 seat)
        const seatsResult = await pool.query(
            'SELECT purchased_seats FROM users WHERE id = $1',
            [req.user.id]
        );
        const purchasedSeats = seatsResult.rows[0]?.purchased_seats || 0;

        const membersResult = await pool.query(
            `SELECT COUNT(*) as used_seats FROM organization_therapists
             WHERE owner_id = $1 AND status != 'removed'`,
            [req.user.id]
        );
        const usedSeats = parseInt(membersResult.rows[0]?.used_seats || 0);

        // Owner takes 1 seat, so available for members = purchasedSeats - 1
        const availableSeats = purchasedSeats - 1;

        if (usedSeats >= availableSeats) {
            return res.status(403).json({
                error: `You have reached your seat limit (${purchasedSeats}). Owner takes 1 seat, leaving ${availableSeats} for team members. For more seats, contact our team at support@mellominds.co.in.`,
                code: 'SEATS_EXCEEDED',
                purchasedSeats,
                usedSeats,
                availableSeats
            });
        }

        // Block if email already exists in the system
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE LOWER(email) = $1', [email]
        );
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'This email is already registered on MelloMinds. Please enter a different email to send an invite.',
                code: 'EMAIL_EXISTS',
            });
        }

        // Check if already invited
        const existing = await pool.query(
            `SELECT id, status FROM organization_therapists WHERE owner_id = $1 AND invite_email = $2`,
            [req.user.id, email]
        );
        if (existing.rows.length > 0 && existing.rows[0].status === 'pending') {
            return res.status(409).json({ error: 'An invite has already been sent to this email.' });
        }

        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO organization_therapists
                (owner_id, therapist_user_id, invite_email, status, invite_token, invite_expires_at)
             VALUES ($1, NULL, $2, 'pending', $3, $4)
             ON CONFLICT (owner_id, invite_email) DO UPDATE
               SET invite_token = $3, invite_expires_at = $4, status = 'pending'`,
            [req.user.id, email, inviteToken, inviteExpires]
        );

        const signupUrl = `${process.env.FRONTEND_URL || 'https://mellominds.co.in'}/signup?invite=${inviteToken}&email=${encodeURIComponent(email)}`;

        console.log(`[INVITE] Generated signup URL: ${signupUrl}`);
        console.log(`[INVITE] Sending email to: ${email}`);

        await sendEmail({
            to: email,
            subject: `${req.user.user_name} invited you to join their team on MelloMinds`,
            html: therapistInviteEmail({ ownerName: req.user.user_name, signupUrl }),
        }).catch(err => console.error('Therapist invite email failed:', err.message));

        console.log(`[INVITE] Email sent successfully to: ${email}`);

        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('therapists_updated');

        return res.status(201).json({
            success: true,
            message: `Invite sent to ${email}.`,
            status: 'pending',
        });
    } catch (err) {
        console.error('POST /api/therapists/invite error:', err.message);
        res.status(500).json({ error: 'Failed to send invite.' });
    }
});

// ─── DELETE /api/therapists/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) return res.status(400).json({ error: 'Invalid ID.' });

    try {
        const member = await pool.query(
            `SELECT therapist_user_id FROM organization_therapists WHERE id = $1 AND owner_id = $2`,
            [id, req.user.id]
        );
        if (member.rows.length === 0) {
            return res.status(404).json({ error: 'Therapist not found in your team.' });
        }

        const therapistUserId = member.rows[0].therapist_user_id;

        // Block removal if member still has active clients
        if (therapistUserId) {
            const clientCount = await pool.query(
                `SELECT COUNT(*) FROM Clients WHERE therapist_id = $1`,
                [therapistUserId]
            );
            if (parseInt(clientCount.rows[0].count) > 0) {
                return res.status(400).json({
                    error: 'This therapist still has clients. Please transfer all their clients before removing them from your team.',
                    code: 'HAS_CLIENTS',
                    client_count: parseInt(clientCount.rows[0].count),
                });
            }

            // Revoke enterprise member status — revert to free
            await pool.query(
                `UPDATE users SET plan_name = 'free', org_role = NULL, org_owner_id = NULL WHERE id = $1`,
                [therapistUserId]
            );
        }

        await pool.query(
            `DELETE FROM organization_therapists WHERE id = $1 AND owner_id = $2`,
            [id, req.user.id]
        );

        const io = getIO();
        if (io) io.to(`user:${req.user.id}`).emit('therapists_updated');

        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/therapists/:id error:', err.message);
        res.status(500).json({ error: 'Failed to remove therapist.' });
    }
});

// ─── GET /api/therapists/member/:memberId/calendars — owner views member calendars
router.get('/member/:memberId/calendars', async (req, res) => {
    const { memberId } = req.params;
    try {
        // Verify this member belongs to the owner
        const check = await pool.query(
            `SELECT therapist_user_id FROM organization_therapists
             WHERE therapist_user_id = $1 AND owner_id = $2`,
            [memberId, req.user.id]
        );
        if (check.rows.length === 0) return res.status(403).json({ error: 'Not authorized.' });

        const result = await pool.query(
            'SELECT * FROM Calendars WHERE user_id = $1 ORDER BY created_at DESC',
            [memberId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('GET member calendars error:', err.message);
        res.status(500).json({ error: 'Failed to fetch calendars.' });
    }
});

// ─── Email templates ──────────────────────────────────────────────────────────

function therapistInviteEmail({ ownerName, signupUrl }) {
    return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap');
    </style>
    <div style="font-family: 'Urbanist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <img src="https://res.cloudinary.com/dp7pklmjk/image/upload/v1780131492/mellominds/mellominds_logo.png" alt="MelloMinds" style="height: 40px;" />
      </div>
      <div style="background: #fff; border-radius: 10px; padding: 32px;">
        <h2 style="font-size: 22px; font-weight: 700; color: #082421; margin: 0 0 12px 0;">You've been invited!</h2>
        <p style="font-size: 15px; color: #444; line-height: 1.6; margin: 0 0 20px 0;">
          <strong>${ownerName}</strong> has invited you to join their therapy team on <strong>MelloMinds</strong>.
        </p>
        <p style="font-size: 14px; color: #666; margin: 0 0 28px 0;">
          Create your account to get started — you'll have access to all team features.
        </p>
        <a href="${signupUrl}" style="display: inline-block; background: #082421; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
          Accept Invite &amp; Sign Up
        </a>
        <p style="font-size: 12px; color: #999; margin: 24px 0 0 0;">This invite expires in 7 days. If you didn't expect this, you can safely ignore this email.</p>
      </div>
    </div>`;
}

export default router;
