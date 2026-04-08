import express from 'express';
import pool from '../config/database.js';
import { sendEmail, enterpriseLeadEmail } from '../lib/email.js';
import rateLimit from 'express-rate-limit';
import { sanitizeStr, isValidEmail, isValidPhone } from '../middleware/sanitize.js';

const router = express.Router();

const leadsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

// POST /api/enterprise/leads
router.post('/leads', leadsLimiter, async (req, res) => {
    let { name, phone, email, company_name, company_website, message } = req.body;

    name = sanitizeStr(name, 100);
    phone = sanitizeStr(phone, 20);
    email = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
    company_name = sanitizeStr(company_name, 150);
    company_website = company_website ? sanitizeStr(company_website, 255) : null;
    message = message ? sanitizeStr(message, 1000) : null;

    if (!name || !phone || !email || !company_name) {
        return res.status(400).json({ error: 'Name, phone, email, and company name are required.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!isValidPhone(phone)) {
        return res.status(400).json({ error: 'Please provide a valid phone number.' });
    }

    try {
        await pool.query(
            `INSERT INTO enterprise_leads (name, phone, email, company_name, company_website, message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [name, phone, email, company_name, company_website, message]
        );
    } catch (err) {
        console.error('Enterprise lead — DB insert failed:', err.message);
        // If table doesn't exist yet, give a clearer hint in dev
        if (err.code === '42P01') {
            return res.status(500).json({ error: 'Database table not found. Run: node backend/scripts/create_enterprise_leads.js' });
        }
        return res.status(500).json({ error: 'Failed to submit enquiry. Please try again.' });
    }

    // Email is fire-and-forget — don't let it block or fail the response
    try {
        const { subject, html } = enterpriseLeadEmail({
            name, phone, email, company_name, company_website, message,
        });

        await sendEmail({
            to: 'sarafaastha13@gmail.com',
            cc: 'adosolve@gmail.com',
            subject,
            html,
        });
    } catch (emailErr) {
        // Non-fatal — lead is already saved in DB
        console.error('Enterprise lead — email notification failed:', emailErr.message);
    }

    res.status(201).json({ success: true });
});

export default router;
