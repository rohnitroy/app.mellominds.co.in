import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

// Verify email transporter on startup so misconfiguration is caught early
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter.verify((err) => {
        if (err) {
            console.error('❌ Email transporter verification failed:', err.message);
            console.error('   Check GMAIL_USER and GMAIL_APP_PASSWORD in your .env');
        } else {
            console.log('✅ Email transporter ready — using', process.env.GMAIL_USER);
        }
    });
} else {
    console.warn('⚠️  Email not configured — GMAIL_USER or GMAIL_APP_PASSWORD missing. Emails will be skipped.');
}

// Warn if FRONTEND_URL is still pointing to localhost in a non-development context
if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.includes('localhost') && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  FRONTEND_URL is set to localhost but NODE_ENV is production. Cancel/reschedule links in emails will be broken.');
}

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
        console.error('   Verify GMAIL_APP_PASSWORD is valid and 2FA is enabled on the Gmail account.');
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
