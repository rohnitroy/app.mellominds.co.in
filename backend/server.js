import './config/env.js'; // MUST be first
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 — Render blocks outbound IPv6
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from './config/passport.js';
import pool from './config/database.js';
import { setIO } from './lib/socket.js';
import { sendEmail, activityNotificationEmail, sessionReminderEmail, sessionReminder30MinEmail, isEmailEnabled } from './lib/email.js';
import { ensureAuditTable, auditMiddleware } from './lib/audit.js';
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
import razorpayRoutes from './routes/razorpay.js';
import enterpriseRoutes from './routes/enterprise.js';
import emailPreferencesRoutes from './routes/emailPreferences.js';
import profileLinkRoutes from './routes/profileLink.js';
import gmailRoutes from './routes/gmail.js';
import publicProfileRoutes from './routes/publicProfile.js';
import therapistsRoutes from './routes/therapists.js';
import chatRoutes from './routes/chat.js';
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
        origin: process.env.NODE_ENV === 'production'
          ? [process.env.FRONTEND_URL].filter(Boolean)
          : [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean),
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

// Validate critical env vars on startup
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('❌ SESSION_SECRET is missing or too short (min 32 chars). Exiting.');
  process.exit(1);
}

if (!process.env.ENCRYPTION_MASTER_SECRET || process.env.ENCRYPTION_MASTER_SECRET.length < 32) {
  console.error('❌ ENCRYPTION_MASTER_SECRET is missing or too short (min 32 chars). Exiting.');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "https://sdk.cashfree.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// Rate limiter for auth endpoints — disabled in development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});

// General rate limiter for all API endpoints — disabled in development
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 200 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again later.' },
});

// Middleware
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Add audit middleware for request tracking
app.use(auditMiddleware);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS — only allow localhost in development
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Session configuration - required for Passport
const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    pool,                     // reuse existing pg pool
    tableName: 'user_sessions',
    createTableIfMissing: true, // auto-create sessions table
    pruneSessionInterval: 60 * 15, // prune expired sessions every 15 min
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours (reduced from 24h)
    sameSite: isProduction ? 'none' : 'lax',
    domain: isProduction ? '.mellominds.co.in' : undefined,
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authLimiter, authRoutes);
app.use('/api/calendars', apiLimiter, calendarRoutes);
app.use('/api/connect-calendar', apiLimiter, connectCalendarRoutes);
app.use('/api/bookings', apiLimiter, bookingsRoutes);
app.use('/api/clients', apiLimiter, clientsRoutes);
app.use('/api/notes', apiLimiter, notesRoutes);
app.use('/api/notifications', apiLimiter, notificationsRoutes);
app.use('/api/activities', apiLimiter, activitiesRoutes);
app.use('/api/availability', apiLimiter, availabilityRoutes);
app.use('/api/cashfree', apiLimiter, cashfreeRoutes);
app.use('/api/razorpay', apiLimiter, razorpayRoutes);
app.use('/api/enterprise', apiLimiter, enterpriseRoutes);
app.use('/api/email-preferences', apiLimiter, emailPreferencesRoutes);
app.use('/api/profile-link', apiLimiter, profileLinkRoutes);
app.use('/api/gmail', apiLimiter, gmailRoutes);
app.use('/api/public', apiLimiter, publicProfileRoutes);
app.use('/api/therapists', apiLimiter, therapistsRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);

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
  const required = ['client_phone','payment_status','payment_amount','form_responses','location_type','cancel_token','cashfree_order_id','cashfree_payment_link','razorpay_order_id','razorpay_payment_id'];
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
      ADD COLUMN IF NOT EXISTS cashfree_payment_link TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255) DEFAULT NULL
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

// ─── 30-Min Session Reminder Cron (runs every 5 min) ─────────────────────────
// Tracks sent reminders in-memory to avoid double-sending within a server run.
const _30minRemindersSentThisRun = new Set();

async function process30MinReminders() {
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
              AND a.start_time BETWEEN NOW() + INTERVAL '25 minutes' AND NOW() + INTERVAL '35 minutes'
        `);

        for (const appt of due.rows) {
            if (_30minRemindersSentThisRun.has(appt.id)) continue;
            if (!await isEmailEnabled(appt.therapist_id, 'session_reminder_30min')) continue;
            const emailContent = sessionReminder30MinEmail({
                clientName: appt.client_name,
                therapistName: appt.therapist_name,
                sessionTitle: appt.title,
                startTime: appt.start_time,
                meetLink: appt.meet_link,
                locationText: appt.location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet'
            });
            await sendEmail({ to: appt.client_email, ...emailContent, senderId: appt.therapist_id });
            _30minRemindersSentThisRun.add(appt.id);
            console.log(`✅ 30-min reminder sent to ${appt.client_email} for "${appt.title}"`);
        }
    } catch (err) {
        console.error('30-min session reminder cron error:', err.message);
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

// Auto-migrate organization_details table on startup
async function ensureOrganizationDetailsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organization_details (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE REFERENCES Users(id) ON DELETE CASCADE,
        company_name VARCHAR(255),
        company_email VARCHAR(150),
        gst VARCHAR(50),
        street TEXT,
        city VARCHAR(100),
        pincode VARCHAR(20),
        state VARCHAR(100),
        country VARCHAR(100),
        enterprise_settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Add enterprise_settings column if it doesn't exist (for existing installs)
    await pool.query(`
      ALTER TABLE organization_details
      ADD COLUMN IF NOT EXISTS enterprise_settings JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✅ organization_details schema verified');
  } catch (err) {
    console.error('⚠️  organization_details schema migration warning:', err.message);
  }
}

// Auto-migrate organization_therapists table on startup
async function ensureOrganizationTherapistsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organization_therapists (
        id SERIAL PRIMARY KEY,
        owner_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        therapist_user_id INT REFERENCES Users(id) ON DELETE SET NULL,
        invite_email VARCHAR(254) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
        invite_token VARCHAR(64),
        invite_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (owner_id, invite_email)
      )
    `);
    console.log('✅ organization_therapists schema verified');
  } catch (err) {
    console.error('⚠️  organization_therapists schema migration warning:', err.message);
  }
}

// Auto-migrate org_role and org_owner_id columns on Users table
async function ensureOrgRoleSchema() {
  try {
    await pool.query(`
      ALTER TABLE Users
      ADD COLUMN IF NOT EXISTS org_role VARCHAR(20) DEFAULT NULL CHECK (org_role IN ('owner', 'member')),
      ADD COLUMN IF NOT EXISTS org_owner_id INT DEFAULT NULL REFERENCES Users(id) ON DELETE SET NULL
    `);
    console.log('✅ Users org_role schema verified');
  } catch (err) {
    console.error('⚠️  Users org_role schema migration warning:', err.message);
  }
}

// Auto-migrate Users table columns on startup
async function ensureUsersSchema() {
  try {
    await pool.query(`
      ALTER TABLE Users
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ
    `);
    console.log('✅ Users schema verified');
  } catch (err) {
    console.error('⚠️  Users schema migration warning:', err.message);
  }
}

// Auto-migrate SessionNotes table columns on startup
async function ensureSessionNotesSchema() {
  try {
    await pool.query(`
      ALTER TABLE SessionNotes
      ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb
    `);
    console.log('✅ SessionNotes schema verified');
  } catch (err) {
    console.error('⚠️  SessionNotes schema migration warning:', err.message);
  }
}

// Auto-migrate chat tables on startup
async function ensureChatSchema() {
  try {
    // Chat conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) DEFAULT 'New Conversation',
        context_data JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Chat messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL,
        message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant')),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
      )
    `);

    // Create indexes if they don't exist
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_active ON chat_conversations(is_active)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at)
    `);

    // Create update function and trigger if they don't exist
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_chat_conversation_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations
    `);
    await pool.query(`
      CREATE TRIGGER update_chat_conversations_updated_at
          BEFORE UPDATE ON chat_conversations
          FOR EACH ROW
          EXECUTE FUNCTION update_chat_conversation_updated_at()
    `);

    console.log('✅ Chat schema verified');
  } catch (err) {
    console.error('⚠️  Chat schema migration warning:', err.message);
  }
}

// Start server
httpServer.listen(PORT, async () => {
  await ensureCalendarsSchema();
  await ensureAppointmentsSchema();
  await ensureUsersSchema();
  await ensureSessionNotesSchema();
  await ensureOrganizationTherapistsSchema();
  await ensureOrgRoleSchema();
  await ensureOrganizationDetailsSchema();
  await ensureChatSchema(); // Initialize chat tables
  await ensureAuditTable(); // Initialize audit logging
  // Run activity reminder cron every hour
  setInterval(processActivityReminders, 60 * 60 * 1000);
  processActivityReminders(); // run once on startup too
  // Run session reminder cron every hour
  setInterval(processSessionReminders, 60 * 60 * 1000);
  processSessionReminders(); // run once on startup too
  // Run 30-min session reminder cron every 5 minutes
  setInterval(process30MinReminders, 5 * 60 * 1000);
  process30MinReminders(); // run once on startup too
  console.log(`🚀 Server running on port ${PORT}`);
});

// Export the app for Vercel serverless functions
export default app;
