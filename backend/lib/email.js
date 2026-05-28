import { Resend } from 'resend';
import { google } from 'googleapis';
import pool from '../config/database.js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Verify Resend is configured on startup
if (process.env.RESEND_API_KEY) {
    console.log('✅ Resend email client ready');
} else {
    console.warn('⚠️  Email not configured — RESEND_API_KEY missing. Emails will be skipped.');
}

// Warn if FRONTEND_URL is still pointing to localhost in a non-development context
if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  FRONTEND_URL is set to localhost but NODE_ENV is production. Cancel/reschedule links in emails will be broken.');
}

/**
 * Check if a user has a specific email type enabled in their preferences.
 * Returns true if enabled or if no preference is set (defaults to on).
 * @param {number} userId
 * @param {string} prefKey - one of the controllable preference keys
 */
export async function isEmailEnabled(userId, prefKey) {
    try {
        const result = await pool.query(
            'SELECT email_preferences FROM Users WHERE id = $1',
            [userId]
        );
        const prefs = result.rows[0]?.email_preferences;
        if (!prefs || prefs[prefKey] === undefined) return true; // default on
        return prefs[prefKey] === true;
    } catch {
        return true; // fail open — don't block emails on DB error
    }
}

/**
 * Get a refreshed Gmail OAuth2 client for a user, or null if not connected.
 * @param {number} userId
 */
async function getGmailClient(userId) {
    const result = await pool.query(
        "SELECT access_token, refresh_token, expiry_date FROM UserIntegrations WHERE user_id = $1 AND provider = 'gmail'",
        [userId]
    );
    if (result.rows.length === 0) return null;

    const { access_token, refresh_token, expiry_date } = result.rows[0];
    if (!refresh_token) return null;

    const GMAIL_CALLBACK_URL =
        process.env.GMAIL_CALLBACK_URL ||
        `http://localhost:${process.env.PORT || 3001}/api/gmail/callback`;

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        GMAIL_CALLBACK_URL
    );
    oauth2Client.setCredentials({ access_token, refresh_token, expiry_date });

    const fiveMinMs = 5 * 60 * 1000;
    if (!expiry_date || Date.now() >= Number(expiry_date) - fiveMinMs) {
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            await pool.query(
                `UPDATE UserIntegrations SET access_token = $1, expiry_date = $2, updated_at = NOW()
                 WHERE user_id = $3 AND provider = 'gmail'`,
                [credentials.access_token, credentials.expiry_date, userId]
            );
            if (credentials.refresh_token) {
                await pool.query(
                    `UPDATE UserIntegrations SET refresh_token = $1 WHERE user_id = $2 AND provider = 'gmail'`,
                    [credentials.refresh_token, userId]
                );
            }
            oauth2Client.setCredentials(credentials);
        } catch (err) {
            console.error(`[gmail] Token refresh failed for user ${userId}:`, err.message);
            return null;
        }
    }
    return oauth2Client;
}

/**
 * Send an email via the user's own Gmail account.
 * @param {object} opts - { userId, fromName, fromEmail, to, cc, subject, html, text? }
 */
async function sendViaGmail({ userId, fromName, fromEmail, to, cc, subject, html, text }) {
    const auth = await getGmailClient(userId);
    if (!auth) {
        console.warn(`[gmail] No valid Gmail client for user ${userId} — falling back to Resend`);
        return false;
    }

    const gmail = google.gmail({ version: 'v1', auth });
    const plainText = text || html.replace(/<[^>]+>/g, '');
    const fromHeader = `${fromName} <${fromEmail}>`;

    // Build RFC 2822 message
    const lines = [
        `From: ${fromHeader}`,
        `To: ${to}`,
        ...(cc ? [`Cc: ${cc}`] : []),
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="boundary"',
        '',
        '--boundary',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        plainText,
        '--boundary',
        'Content-Type: text/html; charset=UTF-8',
        '',
        html,
        '--boundary--',
    ];

    const raw = Buffer.from(lines.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
        console.log(`✅ Gmail sent (user ${userId}) to ${to}: ${subject}`);
        return true;
    } catch (err) {
        console.error(`[gmail] Send failed for user ${userId}:`, err.message);
        if (err.message?.includes('Gmail API has not been used') || err.message?.includes('disabled')) {
            console.error('[gmail] ⚠️  Enable the Gmail API at: https://console.cloud.google.com/apis/library/gmail.googleapis.com');
        }
        return false;
    }
}

/**
 * Send an email. If the therapist (identified by senderId) has use_own_email enabled
 * and is on the enterprise plan, sends via their Gmail. Otherwise uses Resend.
 *
 * @param {object} opts - { to, cc, subject, html, text?, senderId? }
 *   senderId: therapist's user ID — required to attempt Gmail routing
 */
export async function sendEmail({ to, cc, subject, html, text, senderId }) {
    // Try Gmail routing if senderId is provided
    if (senderId) {
        try {
            const userResult = await pool.query(
                "SELECT plan_name, email_preferences FROM Users WHERE id = $1",
                [senderId]
            );
            const user = userResult.rows[0];
            const useOwnEmail = user?.email_preferences?.use_own_email === true;
            const isEnterprise = user?.plan_name === 'enterprise';

            if (isEnterprise && useOwnEmail) {
                // Get the connected Gmail address
                const integResult = await pool.query(
                    "SELECT calendar_id as gmail_email FROM UserIntegrations WHERE user_id = $1 AND provider = 'gmail'",
                    [senderId]
                );
                const gmailEmail = integResult.rows[0]?.gmail_email;
                if (gmailEmail) {
                    const sent = await sendViaGmail({
                        userId: senderId,
                        fromName: user.user_name || 'MelloMinds',
                        fromEmail: gmailEmail,
                        to, cc, subject, html, text,
                    });
                    if (sent) return;
                    // Fall through to Resend on failure
                }
            }
        } catch (err) {
            console.error('[sendEmail] Gmail routing check failed:', err.message);
            // Fall through to Resend
        }
    }

    // Default: Resend
    if (!process.env.RESEND_API_KEY) {
        console.warn('Email not configured — skipping send.');
        return;
    }
    try {
        await resend.emails.send({
            from: 'MelloMinds <noreply@mellominds.co.in>',
            to,
            ...(cc ? { cc } : {}),
            subject,
            html,
            text: text || html.replace(/<[^>]+>/g, ''),
        });
        console.log(`✅ Email sent to ${to}: ${subject}`);
    } catch (err) {
        console.error(`❌ Email failed to ${to}:`, err.message);
        console.error('   Verify RESEND_API_KEY is valid.');
    }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export function bookingConfirmationEmail({ clientName, therapistName, sessionTitle, startTime, meetLink, locationText, cancelToken, frontendUrl }) {
    const dateStr = new Date(startTime).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
    const manageUrl = cancelToken && frontendUrl ? `${frontendUrl}/manage-booking/${cancelToken}` : null;

    return {
        subject: `Booking Confirmed — ${sessionTitle}`,
        html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f9f9f9; padding: 32px;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">Booking Confirmed 🎉</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color: #333; font-size: 15px;">Your session has been confirmed with <strong>${therapistName}</strong>.</p>
                <div style="background: #f4fffe; border-left: 4px solid #2D7579; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
                    <p style="margin: 0 0 8px; color: #082421; font-weight: 600; font-size: 16px;">${sessionTitle}</p>
                    <p style="margin: 0 0 6px; color: #555; font-size: 14px;">📅 ${dateStr}</p>
                    <p style="margin: 0; color: #555; font-size: 14px;">📍 ${locationText || 'Google Meet'}</p>
                </div>
                ${meetLink ? `<p style="text-align: center; margin: 24px 0;">
                    <a href="${meetLink}" style="background: #082421; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Join Google Meet</a>
                </p>` : ''}
                ${manageUrl ? `<div style="border-top: 1px solid #eee; margin-top: 28px; padding-top: 20px; text-align: center;">
                    <p style="color: #666; font-size: 13px; margin-bottom: 12px;">Need to make changes?</p>
                    <a href="${manageUrl}" style="background: #f5f5f5; color: #333; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px; border: 1px solid #e0e0e0;">Cancel or Reschedule</a>
                </div>` : ''}
                <p style="color: #888; font-size: 13px; margin-top: 32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function transferRequestEmail({ toTherapistName, fromTherapistName, clientName }) {
    return {
        subject: `Client Transfer Request — ${clientName}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Client Transfer Request</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${toTherapistName}</strong>,</p>
                <p style="color: #333; font-size: 15px;"><strong>${fromTherapistName}</strong> has requested to transfer client <strong>${clientName}</strong> to you.</p>
                <p style="color: #333; font-size: 15px;">Please log in to MelloMinds and check your notifications to approve or reject this request.</p>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function transferApprovedEmail({ fromTherapistName, clientName }) {
    return {
        subject: `Transfer Approved — ${clientName}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Transfer Approved ✓</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${fromTherapistName}</strong>,</p>
                <p style="color: #333; font-size: 15px;">Your transfer request for client <strong>${clientName}</strong> has been approved.</p>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function transferRejectedEmail({ fromTherapistName, clientName }) {
    return {
        subject: `Transfer Declined — ${clientName}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Transfer Declined</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${fromTherapistName}</strong>,</p>
                <p style="color: #333; font-size: 15px;">Your transfer request for client <strong>${clientName}</strong> was declined by the receiving therapist.</p>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function cancellationEmail({ clientName, therapistName, sessionTitle, startTime, cancelledBy }) {
    const dateStr = new Date(startTime).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
    return {
        subject: `Session Cancelled — ${sessionTitle}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
            <div style="background: #c62828; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Session Cancelled</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color: #333; font-size: 15px;">Your session <strong>${sessionTitle}</strong> with <strong>${therapistName}</strong> scheduled for <strong>${dateStr}</strong> has been cancelled${cancelledBy ? ` by ${cancelledBy}` : ''}.</p>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">If you'd like to rebook, please use your therapist's booking link.</p>
                <p style="color: #888; font-size: 13px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function rescheduleConfirmationEmail({ clientName, therapistName, sessionTitle, newStartTime, meetLink }) {
    const dateStr = new Date(newStartTime).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
    return {
        subject: `Session Rescheduled — ${sessionTitle}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
            <div style="background: #1565c0; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Session Rescheduled ✓</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color: #333; font-size: 15px;">Your session <strong>${sessionTitle}</strong> with <strong>${therapistName}</strong> has been rescheduled to:</p>
                <div style="background: #e3f2fd; border-left: 4px solid #1565c0; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
                    <p style="margin: 0; color: #082421; font-weight: 600; font-size: 15px;">📅 ${dateStr}</p>
                </div>
                ${meetLink ? `<p style="text-align: center; margin: 24px 0;">
                    <a href="${meetLink}" style="background: #082421; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Join Google Meet</a>
                </p>` : ''}
                <p style="color: #888; font-size: 13px; margin-top: 32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function transferCancelledEmail({ recipientName, fromTherapistName, clientName, isClient = false }) {
    const subject = `Transfer Cancelled — ${clientName}`;
    const body = isClient
        ? `A transfer request involving your care has been cancelled by your therapist <strong>${fromTherapistName}</strong>. You will continue your sessions as before.`
        : `<strong>${fromTherapistName}</strong> has cancelled the pending transfer request for client <strong>${clientName}</strong>. No action is required from you.`;
    return {
        subject,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 20px;">Transfer Cancelled</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${recipientName}</strong>,</p>
                <p style="color: #333; font-size: 15px;">${body}</p>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function bookingLinkEmail({ clientName, therapistName, calendarTitle, calendarDescription, duration, bookingLink }) {
    return {
        subject: `Book a session with ${therapistName} — ${calendarTitle}`,
        html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f9f9f9; padding: 32px;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">You're invited to book a session 📅</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color: #333; font-size: 15px;"><strong>${therapistName}</strong> has shared a booking link with you.</p>
                <div style="background: #f4fffe; border-left: 4px solid #2D7579; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
                    <p style="margin: 0 0 6px; color: #082421; font-weight: 700; font-size: 16px;">${calendarTitle}</p>
                    ${calendarDescription ? `<p style="margin: 0 0 6px; color: #555; font-size: 14px;">${calendarDescription}</p>` : ''}
                    <p style="margin: 0; color: #555; font-size: 14px;">⏱ Duration: ${duration}</p>
                </div>
                <p style="text-align: center; margin: 28px 0;">
                    <a href="${bookingLink}" style="background: #082421; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Book Your Session</a>
                </p>
                <p style="color: #888; font-size: 13px; margin-top: 32px; text-align: center;">Or copy this link: <a href="${bookingLink}" style="color: #2D7579;">${bookingLink}</a></p>
                <p style="color: #888; font-size: 13px; margin-top: 24px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function forgotPasswordEmail({ tempPassword }) {
    return {
        subject: 'Your Temporary Password — MelloMinds',
        html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f9f9f9; padding: 32px;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">Password Reset</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">You requested a password reset for your MelloMinds account.</p>
                <p style="color: #333; font-size: 15px;">Your temporary password is:</p>
                <div style="background: #f4fffe; border-left: 4px solid #2D7579; border-radius: 8px; padding: 16px 20px; margin: 24px 0; text-align: center;">
                    <p style="margin: 0; color: #082421; font-weight: 700; font-size: 22px; letter-spacing: 2px;">${tempPassword}</p>
                </div>
                <p style="color: #555; font-size: 14px;">Please log in with this temporary password and change it immediately from your profile settings.</p>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">If you did not request this, please ignore this email. Your account is safe.</p>
                <p style="color: #888; font-size: 13px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function enterpriseLeadEmail({ name, phone, email, company_name, company_website, message }) {
    const websiteRow = company_website
        ? `<tr><td style="padding:8px 0;color:#555;font-size:14px;width:140px;font-weight:600;">Company Website</td><td style="padding:8px 0;color:#333;font-size:14px;"><a href="${company_website}" style="color:#2D7579;">${company_website}</a></td></tr>`
        : '';
    const messageRow = message
        ? `<div style="margin-top:20px;background:#f4fffe;border-left:4px solid #2D7579;border-radius:8px;padding:16px 20px;">
               <p style="margin:0 0 6px;color:#082421;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
               <p style="margin:0;color:#333;font-size:14px;line-height:1.6;">${message}</p>
           </div>`
        : '';
    return {
        subject: `🚀 New Enterprise Lead — ${company_name} (${name})`,
        html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#f9f9f9;padding:32px;">
            <div style="background:linear-gradient(135deg,#082421 0%,#2D7579 100%);border-radius:12px 12px 0 0;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:22px;">New Enterprise Lead 🚀</h1>
                <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">Someone is interested in MelloMinds Enterprise</p>
            </div>
            <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr><td style="padding:8px 0;color:#555;font-size:14px;width:140px;font-weight:600;">Name</td><td style="padding:8px 0;color:#333;font-size:14px;">${name}</td></tr>
                    <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#555;font-size:14px;font-weight:600;">Email</td><td style="padding:8px 0;color:#333;font-size:14px;"><a href="mailto:${email}" style="color:#2D7579;">${email}</a></td></tr>
                    <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#555;font-size:14px;font-weight:600;">Phone</td><td style="padding:8px 0;color:#333;font-size:14px;">${phone}</td></tr>
                    <tr style="border-top:1px solid #f0f0f0;"><td style="padding:8px 0;color:#555;font-size:14px;font-weight:600;">Company</td><td style="padding:8px 0;color:#333;font-size:14px;">${company_name}</td></tr>
                    ${websiteRow}
                </table>
                ${messageRow}
                <div style="margin-top:28px;padding-top:20px;border-top:1px solid #eee;">
                    <p style="margin:0;color:#888;font-size:12px;">Submitted via MelloMinds Enterprise enquiry form · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                </div>
            </div>
        </div>`
    };
}

export function activityNotificationEmail({ clientName, therapistName, activityName, activityDescription, isReminder = false, reminderNum = null }) {
    const subject = isReminder
        ? `Reminder: Activity from your therapist — ${activityName}`
        : `New Activity Suggestion from ${therapistName}`;
    const heading = isReminder ? `Activity Reminder 🔔` : `New Activity Suggestion 💡`;
    const intro = isReminder
        ? `This is reminder #${reminderNum} for an activity your therapist <strong>${therapistName}</strong> suggested for you.`
        : `Your therapist <strong>${therapistName}</strong> has suggested a new activity for you.`;
    return {
        subject,
        html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;padding:32px;">
            <div style="background:#082421;border-radius:12px 12px 0 0;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:22px;">${heading}</h1>
            </div>
            <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
                <p style="color:#333;font-size:15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color:#333;font-size:15px;">${intro}</p>
                <div style="background:#f4fffe;border-left:4px solid #2D7579;border-radius:8px;padding:16px 20px;margin:24px 0;">
                    <p style="margin:0 0 8px;color:#082421;font-weight:700;font-size:16px;">${activityName}</p>
                    ${activityDescription ? `<p style="margin:0;color:#555;font-size:14px;line-height:1.6;">${activityDescription}</p>` : ''}
                </div>
                <p style="color:#888;font-size:13px;margin-top:32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function sessionReminderEmail({ clientName, therapistName, sessionTitle, startTime, meetLink, locationText }) {
    const dateStr = new Date(startTime).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
    return {
        subject: `Reminder: Your session tomorrow — ${sessionTitle}`,
        html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;padding:32px;">
            <div style="background:#082421;border-radius:12px 12px 0 0;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:22px;">Session Reminder 🔔</h1>
            </div>
            <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
                <p style="color:#333;font-size:15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color:#333;font-size:15px;">This is a reminder that you have a session coming up in approximately 24 hours.</p>
                <div style="background:#f4fffe;border-left:4px solid #2D7579;border-radius:8px;padding:16px 20px;margin:24px 0;">
                    <p style="margin:0 0 8px;color:#082421;font-weight:600;font-size:16px;">${sessionTitle}</p>
                    <p style="margin:0 0 6px;color:#555;font-size:14px;">👤 With ${therapistName}</p>
                    <p style="margin:0 0 6px;color:#555;font-size:14px;">📅 ${dateStr}</p>
                    <p style="margin:0;color:#555;font-size:14px;">📍 ${locationText || 'Google Meet'}</p>
                </div>
                ${meetLink ? `<p style="text-align:center;margin:24px 0;">
                    <a href="${meetLink}" style="background:#082421;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Join Google Meet</a>
                </p>` : ''}
                <p style="color:#888;font-size:13px;margin-top:32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function newUserAlertEmail({ userName, email, authProvider }) {
    const providerLabel = authProvider === 'google' ? 'Google OAuth' : 'Email & Password';
    const providerColor = authProvider === 'google' ? '#4285F4' : '#2D7579';
    return {
        subject: `🎉 New Therapist Joined — ${userName}`,
        html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;padding:32px;">
            <div style="background:linear-gradient(135deg,#082421 0%,#2D7579 100%);border-radius:12px 12px 0 0;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:22px;">New Therapist Joined 🎉</h1>
                <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">A new user has created an account on MelloMinds</p>
            </div>
            <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding:10px 0;color:#555;font-size:14px;width:130px;font-weight:600;">Name</td>
                        <td style="padding:10px 0;color:#082421;font-size:14px;font-weight:700;">${userName}</td>
                    </tr>
                    <tr style="border-top:1px solid #f0f0f0;">
                        <td style="padding:10px 0;color:#555;font-size:14px;font-weight:600;">Email</td>
                        <td style="padding:10px 0;font-size:14px;"><a href="mailto:${email}" style="color:#2D7579;text-decoration:none;">${email}</a></td>
                    </tr>
                    <tr style="border-top:1px solid #f0f0f0;">
                        <td style="padding:10px 0;color:#555;font-size:14px;font-weight:600;">Signed up via</td>
                        <td style="padding:10px 0;">
                            <span style="background:${providerColor};color:#fff;font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;">${providerLabel}</span>
                        </td>
                    </tr>
                    <tr style="border-top:1px solid #f0f0f0;">
                        <td style="padding:10px 0;color:#555;font-size:14px;font-weight:600;">Joined at</td>
                        <td style="padding:10px 0;color:#333;font-size:14px;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST</td>
                    </tr>
                </table>
                <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;">
                    <p style="margin:0;color:#888;font-size:12px;">MelloMinds platform · Auto-generated new user alert</p>
                </div>
            </div>
        </div>`
    };
}

export function passwordResetEmail({ resetUrl }) {
    return {
        subject: 'Reset Your Password — MelloMinds',
        html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #f9f9f9; padding: 32px;">
            <div style="background: #082421; border-radius: 12px 12px 0 0; padding: 24px 32px;">
                <h1 style="color: #fff; margin: 0; font-size: 22px;">Reset Your Password</h1>
            </div>
            <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e0e0e0;">
                <p style="color: #333; font-size: 15px;">You requested a password reset for your MelloMinds account.</p>
                <p style="color: #333; font-size: 15px;">Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.</p>
                <p style="text-align: center; margin: 32px 0;">
                    <a href="${resetUrl}" style="background: #082421; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px;">Reset Password</a>
                </p>
                <p style="color: #888; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="color: #2D7579; font-size: 13px; word-break: break-all;">${resetUrl}</p>
                <p style="color: #888; font-size: 13px; margin-top: 32px;">If you did not request this, you can safely ignore this email. Your password will not change.</p>
                <p style="color: #888; font-size: 13px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function sessionReminder30MinEmail({ clientName, therapistName, sessionTitle, startTime, meetLink, locationText }) {
    const dateStr = new Date(startTime).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
    return {
        subject: `Starting soon: Your session in 30 minutes — ${sessionTitle}`,
        html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;padding:32px;">
            <div style="background:#082421;border-radius:12px 12px 0 0;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:22px;">Starting in 30 Minutes ⏰</h1>
            </div>
            <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
                <p style="color:#333;font-size:15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color:#333;font-size:15px;">Your session is starting in <strong>30 minutes</strong>. Get ready!</p>
                <div style="background:#f4fffe;border-left:4px solid #2D7579;border-radius:8px;padding:16px 20px;margin:24px 0;">
                    <p style="margin:0 0 8px;color:#082421;font-weight:600;font-size:16px;">${sessionTitle}</p>
                    <p style="margin:0 0 6px;color:#555;font-size:14px;">👤 With ${therapistName}</p>
                    <p style="margin:0 0 6px;color:#555;font-size:14px;">📅 ${dateStr}</p>
                    <p style="margin:0;color:#555;font-size:14px;">📍 ${locationText || 'Google Meet'}</p>
                </div>
                ${meetLink ? `<p style="text-align:center;margin:24px 0;">
                    <a href="${meetLink}" style="background:#082421;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Join Google Meet</a>
                </p>` : ''}
                <p style="color:#888;font-size:13px;margin-top:32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}

export function sessionReminder60MinEmail({ clientName, therapistName, sessionTitle, startTime, meetLink, locationText }) {
    const dateStr = new Date(startTime).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
    return {
        subject: `Reminder: Your session in 1 hour — ${sessionTitle}`,
        html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;padding:32px;">
            <div style="background:#082421;border-radius:12px 12px 0 0;padding:24px 32px;">
                <h1 style="color:#fff;margin:0;font-size:22px;">Session Reminder 🔔</h1>
            </div>
            <div style="background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e0e0e0;">
                <p style="color:#333;font-size:15px;">Hi <strong>${clientName}</strong>,</p>
                <p style="color:#333;font-size:15px;">This is a reminder that you have a session coming up in approximately 1 hour.</p>
                <div style="background:#f4fffe;border-left:4px solid #2D7579;border-radius:8px;padding:16px 20px;margin:24px 0;">
                    <p style="margin:0 0 8px;color:#082421;font-weight:600;font-size:16px;">${sessionTitle}</p>
                    <p style="margin:0 0 6px;color:#555;font-size:14px;">👤 With ${therapistName}</p>
                    <p style="margin:0 0 6px;color:#555;font-size:14px;">📅 ${dateStr}</p>
                    <p style="margin:0;color:#555;font-size:14px;">📍 ${locationText || 'Google Meet'}</p>
                </div>
                ${meetLink ? `<p style="text-align:center;margin:24px 0;">
                    <a href="${meetLink}" style="background:#082421;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Join Google Meet</a>
                </p>` : ''}
                <p style="color:#888;font-size:13px;margin-top:32px;">— The MelloMinds Team</p>
            </div>
        </div>`
    };
}
