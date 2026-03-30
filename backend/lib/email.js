import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

/**
 * Send an email.
 * @param {object} opts - { to, subject, html, text? }
 */
export async function sendEmail({ to, subject, html, text }) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('Email not configured — skipping send.');
        return;
    }
    try {
        await transporter.sendMail({
            from: `"MelloMinds" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]+>/g, ''),
        });
        console.log(`✅ Email sent to ${to}: ${subject}`);
    } catch (err) {
        // Non-fatal — log but don't crash the request
        console.error(`❌ Email failed to ${to}:`, err.message);
    }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export function bookingConfirmationEmail({ clientName, therapistName, sessionTitle, startTime, meetLink, locationText }) {
    const dateStr = new Date(startTime).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });

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
                <p style="color: #888; font-size: 13px; margin-top: 32px;">If you need to reschedule or cancel, please contact your therapist directly.</p>
                <p style="color: #888; font-size: 13px;">— The MelloMinds Team</p>
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
