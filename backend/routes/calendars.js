import express from 'express';
import pool from '../config/database.js';
import { sanitizeStr, isValidSlug } from '../middleware/sanitize.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

// GET /api/calendars/public/:userId/:slug
router.get('/public/:userId/:slug', async (req, res) => {
    try {
        const { userId, slug } = req.params;
        console.log(`[DEBUG] Fetching calendar for userId=${userId}, slug=${slug}`);
        const result = await pool.query(
            `SELECT c.*, u.user_name as therapist_name, u.profile_picture 
             FROM Calendars c
             JOIN Users u ON c.user_id = u.id
             WHERE c.user_id = $1 AND (c.slug = $2 OR c.slug = $3)`,
            [userId, slug, slug.startsWith('/') ? slug : `/${slug}`]
        );
        console.log(`[DEBUG] Query result: ${result.rows.length} rows found`);
        if (result.rows.length === 0) {
            console.log(`[DEBUG] No calendar found. Checking what calendars exist for user ${userId}:`);
            const allCals = await pool.query(`SELECT id, slug, title FROM Calendars WHERE user_id = $1`, [userId]);
            console.log(`[DEBUG] Available calendars:`, allCals.rows);
            
            // Also check all calendars in system
            const allSystemCals = await pool.query(`SELECT id, user_id, slug, title FROM Calendars LIMIT 10`);
            console.log(`[DEBUG] All calendars in system:`, allSystemCals.rows);
            
            return res.status(404).json({ error: 'Calendar not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching public calendar:', error);
        console.error('[DEBUG] Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({ error: 'Failed to fetch calendar' });
    }
});

// GET /api/calendars/public/u/:profileSlug/:slug — alias using custom profile slug
router.get('/public/u/:profileSlug/:slug', async (req, res) => {
    try {
        const { profileSlug, slug } = req.params;
        const result = await pool.query(
            `SELECT c.*, u.user_name as therapist_name, u.profile_picture
             FROM Calendars c
             JOIN Users u ON c.user_id = u.id
             WHERE u.profile_slug = $1 AND (c.slug = $2 OR c.slug = $3)`,
            [profileSlug, slug, slug.startsWith('/') ? slug : `/${slug}`]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching public calendar by profile slug:', error);
        res.status(500).json({ error: 'Failed to fetch calendar' });
    }
});

// GET /api/calendars/payment-gateways - Returns available payment modes
// "offline" is always available; connected PGs are appended dynamically
router.get('/payment-gateways', async (req, res) => {
    const offline = { value: 'offline', label: 'Cash / UPI / Offline Payment' };

    // If not authenticated, return only offline
    if (!req.isAuthenticated()) {
        return res.json([offline]);
    }

    try {
        const result = await pool.query(
            `SELECT provider FROM UserIntegrations WHERE user_id = $1 AND provider NOT IN ('google')`,
            [req.user.id]
        );

        const pgMap = {
            razorpay: 'Razorpay',
            cashfree: 'Cashfree',
        };

        const connected = result.rows
            .filter((r) => pgMap[r.provider])
            .map((r) => ({ value: r.provider, label: pgMap[r.provider] }));

        res.json([offline, ...connected]);
    } catch (error) {
        console.error('Error fetching payment gateways:', error);
        res.json([offline]);
    }
});

router.use(ensureAuthenticated);

// GET /api/calendars
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM Calendars WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching calendars:', error);
        res.status(500).json({ error: 'Failed to fetch calendars' });
    }
});

// POST /api/calendars
router.post('/', async (req, res) => {
    try {
        const { title, duration, description, slug, form_data, payment_data, locations, schedule_settings, max_attendees, for_user_id } = req.body;

        // If for_user_id is provided, verify the requester is the org owner of that user
        let targetUserId = req.user.id;
        if (for_user_id) {
            const ownerCheck = await pool.query(
                `SELECT id FROM organization_therapists
                 WHERE owner_id = $1 AND therapist_user_id = $2 AND status = 'active'`,
                [req.user.id, for_user_id]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'You are not authorized to create calendars for this user.' });
            }
            targetUserId = for_user_id;
        }

        if (!title || !duration) {
            return res.status(400).json({ error: 'Title and duration are required' });
        }
        if (title.length > 150) {
            return res.status(400).json({ error: 'Title too long (max 150 chars).' });
        }
        if (slug && !isValidSlug(slug.replace(/^\//, ''))) {
            return res.status(400).json({ error: 'Slug must be lowercase alphanumeric and hyphens only.' });
        }

        // Require Google Calendar connection — check for the target user
        const googleCheck = await pool.query(
            "SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = 'google'",
            [targetUserId]
        );
        if (googleCheck.rows.length === 0) {
            const msg = for_user_id
                ? 'This therapist has not connected their Google Calendar yet.'
                : 'Please connect your Google Calendar in Settings before creating a calendar.';
            return res.status(403).json({ error: msg });
        }

        const finalSlug = slug || `/${title.toLowerCase().replace(/ /g, '-')}-${Date.now()}`;

        // Validate payment gateway if payment is enabled
        if (payment_data?.acceptPayment && payment_data?.paymentGateways?.length) {
            const gateway = payment_data.paymentGateways[0];
            
            if (gateway !== 'offline') {
                // Check if gateway is connected
                const gwCheck = await pool.query(
                    `SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = $2`,
                    [targetUserId, gateway]
                );
                
                if (gwCheck.rows.length === 0) {
                    return res.status(400).json({ 
                        error: `Payment gateway '${gateway}' is not connected. Please connect it first in settings.` 
                    });
                }
            }
        }

        const result = await pool.query(
            `INSERT INTO Calendars 
                (user_id, title, duration, description, slug, form_data,
                 payment_enabled, payment_gateway, prices, cancellation_policy, reschedule_policy,
                 locations, schedule_settings) 
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) 
             RETURNING *`,
            [
                targetUserId, title, duration, description, finalSlug,
                form_data ? JSON.stringify(form_data) : null,
                payment_data?.acceptPayment || false,
                payment_data?.paymentGateways?.[0] || null,
                payment_data?.prices?.length ? JSON.stringify(payment_data.prices) : null,
                payment_data?.cancellation ? JSON.stringify(payment_data.cancellation) : null,
                payment_data?.reschedule ? JSON.stringify(payment_data.reschedule) : null,
                locations ? JSON.stringify(locations) : null,
                schedule_settings ? JSON.stringify(schedule_settings) : null,
            ]
        );

        // Log validation
        if (payment_data?.acceptPayment) {
            await pool.query(
                `INSERT INTO PolicyValidation (calendar_id, policy_type, is_valid, error_message)
                 VALUES ($1, 'payment_gateway', true, NULL)`,
                [result.rows[0].id]
            );
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating calendar:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'Calendar with this slug already exists' });
        res.status(500).json({ error: 'Failed to create calendar' });
    }
});

// PUT /api/calendars/:id
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const calendarId = req.params.id;
        const { title, duration, description, slug, is_active, form_data, payment_data, locations, schedule_settings, max_attendees, for_user_id } = req.body;

        // If for_user_id provided, verify ownership and use that as the target
        let targetUserId = userId;
        if (for_user_id) {
            const ownerCheck = await pool.query(
                `SELECT id FROM organization_therapists
                 WHERE owner_id = $1 AND therapist_user_id = $2 AND status = 'active'`,
                [userId, for_user_id]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ error: 'You are not authorized to edit calendars for this user.' });
            }
            targetUserId = for_user_id;
        }

        const fields = [];
        const values = [];

        const add = (col, val) => { values.push(val); fields.push(`${col} = $${values.length}`); };

        if (title !== undefined) add('title', title);
        if (duration !== undefined) add('duration', duration);
        if (description !== undefined) add('description', description);
        if (is_active !== undefined) add('is_active', is_active);
        if (form_data !== undefined) add('form_data', JSON.stringify(form_data));
        if (slug !== undefined) add('slug', slug.startsWith('/') ? slug : `/${slug}`);
        if (locations !== undefined) add('locations', JSON.stringify(locations));
        if (schedule_settings !== undefined) add('schedule_settings', JSON.stringify(schedule_settings));
        if (max_attendees !== undefined) add('max_attendees', max_attendees ? parseInt(max_attendees) : null);

        if (payment_data !== undefined) {
            add('payment_enabled', payment_data.acceptPayment || false);
            
            // Validate payment gateway if payment is enabled
            if (payment_data?.acceptPayment && payment_data?.paymentGateways?.length) {
                const gateway = payment_data.paymentGateways[0];
                
                if (gateway !== 'offline') {
                    // Check if gateway is connected
                    const gwCheck = await pool.query(
                        `SELECT id FROM UserIntegrations WHERE user_id = $1 AND provider = $2`,
                        [targetUserId, gateway]
                    );
                    
                    if (gwCheck.rows.length === 0) {
                        return res.status(400).json({ 
                            error: `Payment gateway '${gateway}' is not connected. Please connect it first in settings.` 
                        });
                    }
                }
                
                // Log validation
                await pool.query(
                    `INSERT INTO PolicyValidation (calendar_id, policy_type, is_valid, error_message)
                     VALUES ($1, 'payment_gateway', true, NULL)`,
                    [calendarId || 'new']
                );
            }
            
            add('payment_gateway', payment_data.paymentGateways?.[0] || null);
            add('prices', payment_data.prices?.length ? JSON.stringify(payment_data.prices) : null);
            add('cancellation_policy', payment_data.cancellation ? JSON.stringify(payment_data.cancellation) : null);
            add('reschedule_policy', payment_data.reschedule ? JSON.stringify(payment_data.reschedule) : null);
        }

        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

        values.push(calendarId, targetUserId);
        const idIdx = values.length - 1;
        const uidIdx = values.length;

        const result = await pool.query(
            `UPDATE Calendars SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${idIdx} AND user_id = $${uidIdx} RETURNING *`,
            values
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar not found or unauthorized' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating calendar:', error);
        if (error.code === '23505') return res.status(409).json({ error: 'Calendar with this slug already exists' });
        res.status(500).json({ error: 'Failed to update calendar' });
    }
});

// DELETE /api/calendars/:id
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM Calendars WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar not found or unauthorized' });
        res.json({ message: 'Calendar deleted successfully' });
    } catch (error) {
        console.error('Error deleting calendar:', error);
        res.status(500).json({ error: 'Failed to delete calendar' });
    }
});

export default router;
