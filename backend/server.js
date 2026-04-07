import './config/env.js'; // MUST be first
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 — Render blocks outbound IPv6
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from './config/passport.js';
import pool from './config/database.js';
import { setIO } from './lib/socket.js';
import { sendEmail, activityNotificationEmail, sessionReminderEmail, isEmailEnabled } from './lib/email.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import calendarRoutes from './routes/calendars.js';
import connectCalendarRoutes from './routes/connect_calendar.js';
import bookingsRoutes from './routes/bookings.js';
import clientsRoutes from './routes/clients.js';
import availabilityRoutes from './routes/availability.js';
import notesRoutes from './routes/notes.js';
import notificationsRoutes from './routes/notifications.js';
import activitiesRoutes from './routes/activities.js';
import cashfreeRoutes from './routes/cashfree.js';
import enterpriseRoutes from './routes/enterprise.js';
import emailPreferencesRoutes from './routes/emailPreferences.js';
import profileLinkRoutes from './routes/profileLink.js';
import gmailRoutes from './routes/gmail.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Socket.io setup
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: [process.env.FRONTEND_URL, 'http://localhost:5173'],
        credentials: true,
    }
});
setIO(io);

io.on('connection', (socket) => {
    // Client joins their own room by userId so we can emit targeted events
    socket.on('join', (userId) => {
        if (userId) socket.join(`user:${userId}`);
    });
});

// Trust the first proxy (required on Render/Heroku/etc. for rate limiting and secure cookies)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads to be served cross-origin
  contentSecurityPolicy: false, // disable CSP here — frontend is a separate origin
}));

// Rate limiter for auth endpoints — 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});

// Middleware
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS configuration - allow frontend to communicate with backend
app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:5173'],
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Session configuration - required for Passport
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? 'none' : 'lax',
    domain: isProduction ? '.mellominds.co.in' : undefined,
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authLimiter, authRoutes);
// NOTE: /api/v1/users is disabled — uses unverified JWT (see lib/tenants.js)
// Uncomment only after replacing extractTenantContext with proper JWT verification
// app.use('/api/v1/users', usersRoutes);
app.use('/api/calendars', calendarRoutes);
app.use('/api/connect-calendar', connectCalendarRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/cashfree', cashfreeRoutes);
app.use('/api/enterprise', enterpriseRoutes);
app.use('/api/email-preferences', emailPreferencesRoutes);
app.use('/api/profile-link', profileLinkRoutes);
app.use('/api/gmail', gmailRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Handle Passport TokenError (OAuth failures)
  if (err.name === 'TokenError') {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed_token`);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Auto-migrate Calendars table columns on startup
async function ensureCalendarsSchema() {
  const required = ['form_data','payment_enabled','payment_gateway','prices','cancellation_policy','reschedule_policy','locations','schedule_settings','max_attendees'];
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'calendars' AND column_name = ANY($1)`,
    [required]
  );
  if (rows.length === required.length) {
    console.log('✅ Calendars schema verified');
    return;
  }
  try {
    await pool.query(`
      ALTER TABLE Calendars
      ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS cancellation_policy JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS reschedule_policy JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS schedule_settings JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS max_attendees INT DEFAULT NULL
    `);
    console.log('✅ Calendars schema verified');
  } catch (err) {
    console.error('⚠️  Calendars schema migration warning:', err.message);
  }
}

// Auto-migrate Appointments table columns on startup
async function ensureAppointmentsSchema() {
  const required = ['client_phone','payment_status','payment_amount','form_responses','location_type','cancel_token','cashfree_order_id','cashfree_payment_link'];
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = ANY($1)`,
    [required]
  );
  if (rows.length === required.length) {
    // Fill any null cancel_tokens without needing ALTER TABLE
    await pool.query(`
      UPDATE Appointments
      SET cancel_token = md5(id::text || random()::text || clock_timestamp()::text)
      WHERE cancel_token IS NULL
    `).catch(() => {});
    console.log('✅ Appointments schema verified');
    return;
  }
  try {
    await pool.query(`
      ALTER TABLE Appointments
      ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending',
      ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS form_responses JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'google_meet',
      ADD COLUMN IF NOT EXISTS cancel_token VARCHAR(64) UNIQUE DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS cashfree_payment_link TEXT DEFAULT NULL
    `);
    await pool.query(`
      UPDATE Appointments
      SET cancel_token = md5(id::text || random()::text || clock_timestamp()::text)
      WHERE cancel_token IS NULL
    `);
    console.log('✅ Appointments schema verified');
  } catch (err) {
    console.error('⚠️  Appointments schema migration warning:', err.message);
  }
}

// ─── Session Reminder Cron (runs every hour, sends 24h-before reminders) ─────
// mello_admin has DML-only rights (no DDL), so we track sent reminders in-memory.
// The 23–25h window is narrow enough that the cron won't double-send within a single server run.
const _remindersSentThisRun = new Set();

async function processSessionReminders() {
    try {
        const due = await pool.query(`
            SELECT a.id, a.title, a.start_time, a.meet_link, a.location_type,
                   a.client_name, a.client_email,
                   a.therapist_id,
                   u.user_name as therapist_name
            FROM Appointments a
            JOIN Users u ON a.therapist_id = u.id
            WHERE a.status NOT IN ('cancelled', 'completed')
              AND a.client_email IS NOT NULL
              AND a.start_time BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
        `);

        for (const appt of due.rows) {
            if (_remindersSentThisRun.has(appt.id)) continue;
            if (!await isEmailEnabled(appt.therapist_id, 'session_reminder')) continue;
            const emailContent = sessionReminderEmail({
                clientName: appt.client_name,
                therapistName: appt.therapist_name,
                sessionTitle: appt.title,
                startTime: appt.start_time,
                meetLink: appt.meet_link,
                locationText: appt.location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet'
            });
            await sendEmail({ to: appt.client_email, ...emailContent, senderId: appt.therapist_id });
            _remindersSentThisRun.add(appt.id);
            console.log(`✅ Session reminder sent to ${appt.client_email} for "${appt.title}"`);
        }
    } catch (err) {
        console.error('Session reminder cron error:', err.message);
    }
}

// ─── Activity Reminder Cron (runs every hour) ─────────────────────────────────
async function processActivityReminders() {
    try {
        // Find activities due for a reminder
        const due = await pool.query(`
            SELECT ca.*, c.name as client_name, c.email as client_email,
                   u.user_name as therapist_name
            FROM ClientActivities ca
            JOIN Clients c ON ca.client_id = c.id
            JOIN Users u ON ca.therapist_id = u.id
            WHERE ca.notify_client = true
              AND ca.reminders_sent < ca.reminder_count
              AND ca.next_reminder_at IS NOT NULL
              AND ca.next_reminder_at <= NOW()
        `);

        for (const act of due.rows) {
            if (!act.client_email) continue;
            if (!await isEmailEnabled(act.therapist_id, 'activity_notification')) continue;
            const reminderNum = act.reminders_sent + 1;
            const emailContent = activityNotificationEmail({
                clientName: act.client_name,
                therapistName: act.therapist_name,
                activityName: act.name,
                activityDescription: act.description,
                isReminder: true,
                reminderNum
            });
            await sendEmail({ to: act.client_email, ...emailContent, senderId: act.therapist_id });

            const newSent = reminderNum;
            const hasMore = newSent < act.reminder_count;
            const nextAt = hasMore
                ? new Date(Date.now() + act.reminder_interval_days * 24 * 60 * 60 * 1000)
                : null;

            await pool.query(
                `UPDATE ClientActivities SET reminders_sent = $1, next_reminder_at = $2 WHERE id = $3`,
                [newSent, nextAt, act.id]
            );
            console.log(`✅ Reminder ${reminderNum}/${act.reminder_count} sent for activity "${act.name}" to ${act.client_email}`);
        }
    } catch (err) {
        console.error('Activity reminder cron error:', err.message);
    }
}

// Start server
httpServer.listen(PORT, async () => {
  await ensureCalendarsSchema();
  await ensureAppointmentsSchema();
  // Run activity reminder cron every hour
  setInterval(processActivityReminders, 60 * 60 * 1000);
  processActivityReminders(); // run once on startup too
  // Run session reminder cron every hour
  setInterval(processSessionReminders, 60 * 60 * 1000);
  processSessionReminders(); // run once on startup too
  console.log(`🚀 Server running on port ${PORT}`);
});

// Export the app for Vercel serverless functions
export default app;
