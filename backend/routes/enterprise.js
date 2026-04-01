import express from 'express';
import pool from '../config/database.js';
import { sendEmail, enterpriseLeadEmail } from '../lib/email.js';

const router = express.Router();

// POST /api/enterprise/leads
router.post('/leads', async (req, res) => {
    const { name, phone, email, company_name, company_website, message } = req.body;

    if (!name?.trim() || !phone?.trim() || !email?.trim() || !company_name?.trim()) {
        return res.status(400).json({ error: 'Name, phone, email, and company name are required.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    try {
        await pool.query(
            `INSERT INTO enterprise_leads (name, phone, email, company_name, company_website, message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                name.trim(),
                phone.trim(),
                email.trim().toLowerCase(),
                company_name.trim(),
                company_website?.trim() || null,
                message?.trim() || null,
            ]
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
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            company_name: company_name.trim(),
            company_website: company_website?.trim() || null,
            message: message?.trim() || null,
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
