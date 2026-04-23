import express from 'express';
import pool from '../config/database.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { sendEmail, transferRequestEmail, transferApprovedEmail, transferRejectedEmail, transferCancelledEmail, bookingLinkEmail, isEmailEnabled } from '../lib/email.js';
import { createNotification } from '../lib/notifications.js';
import { getIO } from '../lib/socket.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Not authenticated' });
};

router.use(ensureAuthenticated);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Static routes first (must come before /:id routes) ──────────────────────

// GET /api/clients/clinical-profile/view?url=... - Generate signed Cloudinary URL
router.get('/clinical-profile/view', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || !url.includes('cloudinary.com')) {
            return res.status(400).json({ error: 'Invalid URL' });
        }

        // Extract public_id and resource_type from the stored URL
        // URL format: https://res.cloudinary.com/<cloud>/<resource_type>/upload/v<ver>/<public_id>.<ext>
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split('/');
        // parts: ['', '<cloud>', '<resource_type>', 'upload', 'v<ver>', ...path, 'filename.ext']
        const resourceType = parts[2]; // 'image' or 'raw'
        const uploadIdx = parts.indexOf('upload');
        // public_id is everything after 'upload/v<version>/' without extension, or after 'upload/' if no version
        let pathParts = parts.slice(uploadIdx + 1);
        // Remove version segment if present (starts with 'v' followed by digits)
        if (/^v\d+$/.test(pathParts[0])) pathParts = pathParts.slice(1);
        const publicIdWithExt = pathParts.join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');

        const signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            sign_url: true,
            secure: true,
            expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
            ...(resourceType !== 'raw' && { flags: 'attachment:false' }),
        });

        res.redirect(signedUrl);
    } catch (err) {
        console.error('Error generating signed URL:', err);
        res.status(500).json({ error: 'Failed to generate file URL' });
    }
});

// GET /api/clients/lookup-therapist?email=...
router.get('/lookup-therapist', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    try {
        const result = await pool.query(
            'SELECT id, user_name, org_role, org_owner_id FROM Users WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ exists: false, error: 'No therapist found with this email' });
        }

        const targetUser = result.rows[0];

        // If current user is a member (org_role='member'), restrict transfer targets
        if (req.user.org_role === 'member') {
            const myOwnerId = req.user.org_owner_id;
            // Can only transfer to: (1) their owner, or (2) sibling members under same owner
            const isOwner = targetUser.id === myOwnerId;
            const isSibling = targetUser.org_owner_id === myOwnerId && targetUser.org_role === 'member';
            if (!isOwner && !isSibling) {
                return res.status(403).json({
                    exists: false,
                    error: 'You can only transfer clients to your organization owner or other members in your team.'
                });
            }
        }

        res.json({ exists: true, name: result.rows[0].user_name });
    } catch (err) {
        console.error('Lookup error:', err);
        res.status(500).json({ error: 'Lookup failed' });
    }
});

// GET /api/clients/transfers/outgoing
router.get('/transfers/outgoing', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                ct.id, ct.status, ct.created_at, ct.updated_at,
                c.name as client_name, c.email as client_email, c.phone as client_phone,
                u.email as to_therapist_email,
                COUNT(a.id) as sessions,
                COALESCE(SUM(CASE WHEN a.payment_status IN ('Paid', 'Partial Refund') THEN a.payment_amount ELSE 0 END), 0) as revenue,
                MAX(a.start_time) as last_session
             FROM ClientTransfers ct
             JOIN Clients c ON ct.client_id = c.id
             JOIN Users u ON ct.to_therapist_id = u.id
             LEFT JOIN Appointments a ON a.client_email = c.email AND a.therapist_id = ct.from_therapist_id
             WHERE ct.from_therapist_id = $1
             GROUP BY ct.id, c.name, c.email, c.phone, u.email
             ORDER BY ct.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching outgoing transfers:', error);
        res.status(500).json({ error: 'Failed to fetch transfers' });
    }
});

// POST /api/clients/transfers/:transferId/approve
router.post('/transfers/:transferId/approve', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const toTherapistId = req.user.id;
        const transferId = parseInt(req.params.transferId);

        const transferRes = await dbClient.query(
            `SELECT ct.*, c.* FROM ClientTransfers ct
             JOIN Clients c ON ct.client_id = c.id
             WHERE ct.id = $1 AND ct.to_therapist_id = $2 AND ct.status = 'pending'`,
            [transferId, toTherapistId]
        );

        if (transferRes.rows.length === 0) {
            return res.status(404).json({ error: 'Transfer request not found or already actioned' });
        }

        const transfer = transferRes.rows[0];
        const opts = transfer.transfer_options || {};

        await dbClient.query('BEGIN');

        const existingClient = await dbClient.query(
            'SELECT id FROM Clients WHERE therapist_id = $1 AND email = $2',
            [toTherapistId, transfer.email]
        );

        if (existingClient.rows.length > 0) {
            await dbClient.query(
                `UPDATE Clients SET name=$1, phone=$2, age=$3, occupation=$4, gender=$5,
                 marital_status=$6, emergency_name=$7, emergency_phone=$8, emergency_relation=$9,
                 updated_at=CURRENT_TIMESTAMP WHERE id=$10`,
                [transfer.name, transfer.phone, transfer.age, transfer.occupation, transfer.gender,
                 transfer.marital_status, transfer.emergency_name, transfer.emergency_phone,
                 transfer.emergency_relation, existingClient.rows[0].id]
            );
        } else {
            await dbClient.query(
                `INSERT INTO Clients (therapist_id, name, email, phone, age, occupation, gender,
                 marital_status, emergency_name, emergency_phone, emergency_relation, manually_added)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)`,
                [toTherapistId, transfer.name, transfer.email, transfer.phone, transfer.age,
                 transfer.occupation, transfer.gender, transfer.marital_status,
                 transfer.emergency_name, transfer.emergency_phone, transfer.emergency_relation]
            );
        }

        if (opts.notes) {
            await dbClient.query(
                `UPDATE SessionNotes SET therapist_id = $1
                 WHERE therapist_id = $2 AND appointment_id IN (
                     SELECT id FROM Appointments WHERE therapist_id = $2 AND client_email = $3
                 )`,
                [toTherapistId, transfer.from_therapist_id, transfer.email]
            );
        }

        if (opts.activities) {
            await dbClient.query(
                `UPDATE ClientActivities SET therapist_id = $1
                 WHERE therapist_id = $2 AND client_id = $3`,
                [toTherapistId, transfer.from_therapist_id, transfer.client_id]
            );
        }

        await dbClient.query(
            `UPDATE ClientTransfers SET status = 'approved', updated_at = NOW() WHERE id = $1`,
            [transferId]
        );

        await dbClient.query(
            `INSERT INTO Notifications (user_id, type, title, description, related_id)
             VALUES ($1, 'transfer_approved', $2, $3, $4)`,
            [transfer.from_therapist_id, 'Transfer Approved',
             `Your transfer request for client "${transfer.name}" has been approved.`, transferId]
        );

        // Also notify the receiving therapist that the transfer is complete
        await dbClient.query(
            `INSERT INTO Notifications (user_id, type, title, description, related_id)
             VALUES ($1, 'transfer_success', $2, $3, $4)`,
            [toTherapistId, 'Client Transfer Successful',
             `Client "${transfer.name}" has been successfully transferred to your account.`, transferId]
        );

        await dbClient.query('COMMIT');

        // Send email to Therapist A
        const fromTherapistRes = await pool.query('SELECT user_name, email FROM Users WHERE id = $1', [transfer.from_therapist_id]);
        if (fromTherapistRes.rows.length > 0 && await isEmailEnabled(toTherapistId, 'transfer_status')) {
            const emailContent = transferApprovedEmail({
                fromTherapistName: fromTherapistRes.rows[0].user_name,
                clientName: transfer.name
            });
            await sendEmail({ to: fromTherapistRes.rows[0].email, ...emailContent, senderId: toTherapistId });
        }

        res.json({ message: 'Transfer approved successfully' });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Error approving transfer:', error);
        res.status(500).json({ error: 'Failed to approve transfer' });
    } finally {
        dbClient.release();
    }
});

// POST /api/clients/transfers/:transferId/reject
router.post('/transfers/:transferId/reject', async (req, res) => {
    try {
        const toTherapistId = req.user.id;
        const transferId = parseInt(req.params.transferId);

        const transferRes = await pool.query(
            `SELECT ct.*, c.name as client_name FROM ClientTransfers ct
             JOIN Clients c ON ct.client_id = c.id
             WHERE ct.id = $1 AND ct.to_therapist_id = $2 AND ct.status = 'pending'`,
            [transferId, toTherapistId]
        );

        if (transferRes.rows.length === 0) {
            return res.status(404).json({ error: 'Transfer request not found or already actioned' });
        }

        const transfer = transferRes.rows[0];

        await pool.query(
            `UPDATE ClientTransfers SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
            [transferId]
        );

        await pool.query(
            `INSERT INTO Notifications (user_id, type, title, description, related_id)
             VALUES ($1, 'transfer_rejected', $2, $3, $4)`,
            [transfer.from_therapist_id, 'Transfer Rejected',
             `Your transfer request for client "${transfer.client_name}" was declined.`, transferId]
        );

        res.json({ message: 'Transfer rejected' });

        // Send email to Therapist A (non-blocking, after response)
        pool.query('SELECT user_name, email FROM Users WHERE id = $1', [transfer.from_therapist_id])
            .then(async r => {
                if (r.rows.length > 0 && await isEmailEnabled(toTherapistId, 'transfer_status')) {
                    const emailContent = transferRejectedEmail({
                        fromTherapistName: r.rows[0].user_name,
                        clientName: transfer.client_name
                    });
                    sendEmail({ to: r.rows[0].email, ...emailContent, senderId: toTherapistId });
                }
            }).catch(() => {});
    } catch (error) {
        console.error('Error rejecting transfer:', error);
        res.status(500).json({ error: 'Failed to reject transfer' });
    }
});

// DELETE /api/clients/transfers/:transferId/cancel - Therapist A cancels a pending transfer they initiated
router.delete('/transfers/:transferId/cancel', async (req, res) => {
    try {
        const fromTherapistId = req.user.id;
        const transferId = parseInt(req.params.transferId);

        const transferRes = await pool.query(
            `SELECT ct.*, c.name as client_name, c.email as client_email,
                    u_from.user_name as from_therapist_name, u_from.email as from_therapist_email,
                    u_to.user_name as to_therapist_name, u_to.email as to_therapist_email
             FROM ClientTransfers ct
             JOIN Clients c ON ct.client_id = c.id
             JOIN Users u_from ON ct.from_therapist_id = u_from.id
             JOIN Users u_to ON ct.to_therapist_id = u_to.id
             WHERE ct.id = $1 AND ct.from_therapist_id = $2 AND ct.status = 'pending'`,
            [transferId, fromTherapistId]
        );

        if (transferRes.rows.length === 0) {
            return res.status(404).json({ error: 'Pending transfer not found or you are not the sender' });
        }

        const t = transferRes.rows[0];

        await pool.query('DELETE FROM ClientTransfers WHERE id = $1', [transferId]);

        res.json({ message: 'Transfer cancelled successfully' });

        // Notify receiving therapist
        createNotification({
            userId: t.to_therapist_id,
            type: 'transfer_cancelled',
            title: 'Transfer Cancelled',
            description: `${t.from_therapist_name} cancelled the transfer request for client "${t.client_name}".`,
            relatedId: transferId
        }).catch(() => {});

        // Email receiving therapist
        isEmailEnabled(fromTherapistId, 'transfer_status').then(enabled => {
            if (!enabled) return;
            sendEmail({
                to: t.to_therapist_email,
                senderId: fromTherapistId,
                ...transferCancelledEmail({
                    recipientName: t.to_therapist_name,
                    fromTherapistName: t.from_therapist_name,
                    clientName: t.client_name
                })
            }).catch(() => {});

            // Email client (if they have an email)
            if (t.client_email) {
                sendEmail({
                    to: t.client_email,
                    senderId: fromTherapistId,
                    ...transferCancelledEmail({
                        recipientName: t.client_name,
                        fromTherapistName: t.from_therapist_name,
                        clientName: t.client_name,
                        isClient: true
                    })
                }).catch(() => {});
            }
        }).catch(() => {});

    } catch (error) {
        console.error('Error cancelling transfer:', error);
        res.status(500).json({ error: 'Failed to cancel transfer' });
    }
});

// POST /api/clients - Create a new client manually
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, email, age, occupation, gender, maritalStatus,
                emergencyName, emergencyPhone, emergencyRelation, calendarId } = req.body;

        if (!name || !name.trim() || !email || !email.trim()) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const result = await pool.query(
            `INSERT INTO Clients 
                (therapist_id, name, email, phone, age, occupation, gender, marital_status,
                 emergency_name, emergency_phone, emergency_relation, manually_added)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
             ON CONFLICT (therapist_id, email) DO NOTHING
             RETURNING *`,
            [userId, name.trim(), email.trim().toLowerCase(), phone || null, age || null,
             occupation || null, gender || null, maritalStatus || null,
             emergencyName || null, emergencyPhone || null, emergencyRelation || null]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({ error: 'A client with this email already exists' });
        }

        const row = result.rows[0];

        // Send welcome email with booking link if a calendar was selected
        if (calendarId) {
            try {
                const calResult = await pool.query(
                    'SELECT title, slug, duration, description FROM Calendars WHERE id = $1 AND user_id = $2 AND is_active = true',
                    [calendarId, userId]
                );
                if (calResult.rows.length > 0) {
                    const cal = calResult.rows[0];
                    const therapistName = req.user.user_name || req.user.email;
                    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                    const slug = cal.slug.replace(/^\//, '');
                    const identifier = req.user.profile_slug || userId;
                    const bookingLink = `${frontendUrl}/book/${identifier}/${slug}`;
                    const emailContent = bookingLinkEmail({
                        clientName: name.trim(),
                        therapistName,
                        calendarTitle: cal.title,
                        calendarDescription: cal.description || '',
                        duration: cal.duration,
                        bookingLink,
                    });
                    await sendEmail({ to: email.trim().toLowerCase(), ...emailContent, senderId: userId });
                }
            } catch (emailErr) {
                console.error('Failed to send welcome email:', emailErr.message);
                // Non-fatal — client was still created
            }
        }

        res.status(201).json({
            id: row.id, name: row.name, phone: row.phone || '', email: row.email,
            sessions: '0', revenue: '₹0', lastSession: '—',
            age: row.age || '', occupation: row.occupation || '',
            gender: row.gender || 'Male', maritalStatus: row.marital_status || 'Single',
            emergencyName: row.emergency_name || '', emergencyPhone: row.emergency_phone || '',
            emergencyRelation: row.emergency_relation || '', manually_added: true
        });

        // Notify therapist of new manually added client (fire-and-forget)
        createNotification({
            userId,
            type: 'new_client',
            title: 'New Client Added',
            description: `Client "${name.trim()}" has been added to your client list.`,
            relatedId: row.id
        }).catch(() => {});

        // Real-time update
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('clients_updated');
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: error.message || 'Failed to create client' });
    }
});

// ─── Parameterized /:id routes last ──────────────────────────────────────────

// GET /api/clients/:id/transfer-info
router.get('/:id/transfer-info', async (req, res) => {
    try {
        const clientRes = await pool.query(
            'SELECT email FROM Clients WHERE id = $1 AND therapist_id = $2',
            [req.params.id, req.user.id]
        );
        if (clientRes.rows.length === 0) return res.json({ transferred: false });

        const clientEmail = clientRes.rows[0].email;

        const result = await pool.query(
            `SELECT ct.created_at, u.email as from_therapist_email
             FROM ClientTransfers ct
             JOIN Clients c ON ct.client_id = c.id
             JOIN Users u ON ct.from_therapist_id = u.id
             WHERE c.email = $1 AND ct.to_therapist_id = $2 AND ct.status = 'approved'
             ORDER BY ct.created_at DESC LIMIT 1`,
            [clientEmail, req.user.id]
        );
        if (result.rows.length === 0) return res.json({ transferred: false });
        res.json({ transferred: true, ...result.rows[0] });
    } catch (err) {
        console.error('Error fetching transfer info:', err);
        res.status(500).json({ error: 'Failed to fetch transfer info' });
    }
});

// POST /api/clients/:id/transfer
router.post('/:id/transfer', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const fromTherapistId = req.user.id;
        const clientId = parseInt(req.params.id);
        const { target_email, transfer_options } = req.body;

        if (!target_email) return res.status(400).json({ error: 'Target therapist email is required' });

        const clientRes = await dbClient.query(
            'SELECT * FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, fromTherapistId]
        );
        if (clientRes.rows.length === 0) return res.status(404).json({ error: 'Client not found' });

        const upcomingRes = await dbClient.query(
            `SELECT COUNT(*) FROM Appointments
             WHERE therapist_id = $1 AND client_email = $2
             AND start_time > NOW() AND status NOT IN ('cancelled', 'completed')`,
            [fromTherapistId, clientRes.rows[0].email]
        );
        if (parseInt(upcomingRes.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot transfer client with upcoming active bookings. Please cancel or complete all future sessions first.'
            });
        }

        const targetRes = await dbClient.query(
            'SELECT id, user_name, email, org_role, org_owner_id FROM Users WHERE LOWER(email) = LOWER($1)',
            [target_email.trim()]
        );
        if (targetRes.rows.length === 0) return res.status(404).json({ error: 'No therapist found with that email address' });

        const toTherapistId = targetRes.rows[0].id;
        if (toTherapistId === fromTherapistId) return res.status(400).json({ error: 'Cannot transfer to yourself' });

        // If current user is a member, enforce org transfer restrictions
        if (req.user.org_role === 'member') {
            const myOwnerId = req.user.org_owner_id;
            const isOwner = toTherapistId === myOwnerId;
            const isSibling = targetRes.rows[0].org_owner_id === myOwnerId && targetRes.rows[0].org_role === 'member';
            if (!isOwner && !isSibling) {
                return res.status(403).json({
                    error: 'You can only transfer clients to your organization owner or other members in your team.'
                });
            }
        }

        const existingTransfer = await dbClient.query(
            `SELECT id FROM ClientTransfers WHERE client_id = $1 AND from_therapist_id = $2 AND status = 'pending'`,
            [clientId, fromTherapistId]
        );
        if (existingTransfer.rows.length > 0) {
            return res.status(409).json({ error: 'A pending transfer request already exists for this client' });
        }

        const fromRes = await dbClient.query('SELECT user_name FROM Users WHERE id = $1', [fromTherapistId]);
        const fromName = fromRes.rows[0]?.user_name || 'A therapist';
        const opts = { notes: transfer_options?.notes ?? false, activities: transfer_options?.activities ?? false };

        await dbClient.query('BEGIN');

        const transferRes = await dbClient.query(
            `INSERT INTO ClientTransfers (client_id, from_therapist_id, to_therapist_id, status, transfer_options)
             VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
            [clientId, fromTherapistId, toTherapistId, JSON.stringify(opts)]
        );
        const transferId = transferRes.rows[0].id;

        const notifRes = await dbClient.query(
            `INSERT INTO Notifications (user_id, type, title, description, related_id)
             VALUES ($1, 'transfer_request', $2, $3, $4) RETURNING id`,
            [toTherapistId, 'Client Transfer Request',
             `${fromName} wants to transfer client "${clientRes.rows[0].name}" to you. Please review and approve or reject.`,
             transferId]
        );

        await dbClient.query(
            'UPDATE ClientTransfers SET notification_id = $1 WHERE id = $2',
            [notifRes.rows[0].id, transferId]
        );

        await dbClient.query('COMMIT');

        // Send email to Therapist B
        if (await isEmailEnabled(req.user.id, 'transfer_request')) {
            const emailContent = transferRequestEmail({
                toTherapistName: targetRes.rows[0].user_name || target_email,
                fromTherapistName: fromName,
                clientName: clientRes.rows[0].name
            });
            await sendEmail({ to: targetRes.rows[0].email, ...emailContent, senderId: req.user.id });
        }

        res.json({ message: `Transfer request sent to ${targetRes.rows[0].user_name || target_email}. Awaiting their approval.` });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Error initiating transfer:', error);
        res.status(500).json({ error: 'Failed to initiate transfer' });
    } finally {
        dbClient.release();
    }
});

// POST /api/clients/:id/clinical-profile - Upload clinical profile file
router.post('/:id/clinical-profile', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const maxSize = 10 * 1024 * 1024;

        if (req.file.size > maxSize) {
            return res.status(400).json({ error: 'File size must be less than 10MB' });
        }

        const therapistId = req.user.id;
        const clientId = req.params.id;

        // Verify client belongs to this therapist
        const ownerCheck = await pool.query(
            'SELECT id, clinical_profile_url FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, therapistId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Client not found or access denied' });
        }

        // Delete old file from Cloudinary if exists
        const oldUrl = ownerCheck.rows[0].clinical_profile_url;
        if (oldUrl && oldUrl.includes('cloudinary.com')) {
            try {
                const publicId = oldUrl.split('/').slice(-2).join('/').split('.')[0];
                await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
            } catch (e) {
                console.error('Error deleting old clinical profile file:', e);
            }
        }

        const isPdf = req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
        const isImage = req.file.mimetype.startsWith('image/');

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'mellominds/clinical-profiles',
                    public_id: `therapist_${therapistId}_client_${clientId}_${Date.now()}`,
                    // PDFs and images use 'image' type so Cloudinary serves them inline.
                    // Everything else (doc, docx, txt) uses 'raw'.
                    resource_type: (isPdf || isImage) ? 'image' : 'raw',
                    ...(isPdf && { format: 'pdf', flags: 'attachment:false' }),
                },
                (error, result) => { if (error) reject(error); else resolve(result); }
            );
            stream.end(req.file.buffer);
        });

        // For raw files (doc/docx/txt) force inline delivery flag in the URL
        const finalUrl = uploadResult.resource_type === 'raw'
            ? uploadResult.secure_url.replace('/raw/upload/', '/raw/upload/fl_attachment:false/')
            : uploadResult.secure_url;

        await pool.query(
            'UPDATE Clients SET clinical_profile_url = $1 WHERE id = $2',
            [finalUrl, clientId]
        );

        res.json({
            url: finalUrl,
            original_name: req.file.originalname,
        });
    } catch (error) {
        console.error('Clinical profile upload error:', error);
        res.status(500).json({ error: 'Failed to upload clinical profile' });
    }
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, phone, age, occupation, gender,
                    marital_status as "maritalStatus",
                    emergency_name as "emergencyName",
                    emergency_phone as "emergencyPhone",
                    emergency_relation as "emergencyRelation",
                    manually_added,
                    clinical_profile_url
             FROM Clients WHERE id = $1 AND therapist_id = $2`,
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching client:', err);
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const clientId = parseInt(req.params.id);
        const { name, phone, email, age, occupation, gender, maritalStatus,
                emergencyName, emergencyPhone, emergencyRelation } = req.body;

        const checkRes = await pool.query(
            'SELECT id FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, userId]
        );
        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Client not found' });

        const result = await pool.query(
            `UPDATE Clients SET
                name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email),
                age = COALESCE($4, age), occupation = COALESCE($5, occupation), gender = COALESCE($6, gender),
                marital_status = COALESCE($7, marital_status), emergency_name = COALESCE($8, emergency_name),
                emergency_phone = COALESCE($9, emergency_phone), emergency_relation = COALESCE($10, emergency_relation),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $11 AND therapist_id = $12 RETURNING *`,
            [name, phone, email, age, occupation, gender, maritalStatus,
             emergencyName, emergencyPhone, emergencyRelation, clientId, userId]
        );

        const row = result.rows[0];

        // Real-time update
        const io = getIO();
        if (io) io.to(`user:${userId}`).emit('clients_updated');

        res.json({
            id: row.id, name: row.name, phone: row.phone, email: row.email,
            age: row.age, occupation: row.occupation, gender: row.gender,
            maritalStatus: row.marital_status, emergencyName: row.emergency_name,
            emergencyPhone: row.emergency_phone, emergencyRelation: row.emergency_relation
        });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: error.message || 'Failed to update client' });
    }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const clientId = parseInt(req.params.id);

        const check = await pool.query(
            'SELECT manually_added FROM Clients WHERE id = $1 AND therapist_id = $2',
            [clientId, userId]
        );
        if (check.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
        if (!check.rows[0].manually_added) return res.status(403).json({ error: 'Only manually added clients can be deleted' });

        // Block deletion if client was involved in any transfer (as sender or receiver)
        const transferCheck = await pool.query(
            `SELECT id FROM ClientTransfers
             WHERE client_id = $1 AND status IN ('pending', 'approved')`,
            [clientId]
        );
        if (transferCheck.rows.length > 0) {
            return res.status(403).json({
                error: 'transferred_client',
                message: 'This client has been involved in a transfer and cannot be deleted. Please contact support at support@mellominds.co.in.'
            });
        }

        await pool.query('DELETE FROM Clients WHERE id = $1 AND therapist_id = $2', [clientId, userId]);
        res.json({ message: 'Client deleted successfully' });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

export default router;
