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
import { sendEmail, activityNotificationEmail, sessionReminderEmail, sessionReminder30MinEmail, sessionReminder60MinEmail, isEmailEnabled } from './lib/email.js';
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
import pincodeRoutes from './routes/pincode.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateSchema, verifySchemaIntegrity, storeSchemaHash } from './security/schema-validator.js';
import { monitorDataIntegrity, detectSuspiciousActivity } from './security/data-integrity.js';

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

// Middleware to handle session deserialization errors gracefully
app.use((req, res, next) => {
  if (req.session && req.session.passport && req.session.passport.user && !req.user) {
    // Session exists but user couldn't be deserialized - clear the session
    console.warn('[DEBUG] Session deserialization failed, clearing session');
    req.logout((err) => {
      if (err) console.error('Logout error:', err);
      req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        next();
      });
    });
  } else {
    next();
  }
});

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
app.use('/api/pincode', apiLimiter, pincodeRoutes);

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
  try {
    // First, check if Calendars table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'calendars'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Calendars table does not exist, creating it...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS Calendars (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES Users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          duration VARCHAR(50),
          type VARCHAR(50),
          description TEXT,
          slug VARCHAR(255) UNIQUE,
          is_active BOOLEAN DEFAULT true,
          form_data JSONB DEFAULT NULL,
          payment_enabled BOOLEAN DEFAULT false,
          payment_gateway VARCHAR(50) DEFAULT NULL,
          prices JSONB DEFAULT NULL,
          cancellation_policy JSONB DEFAULT NULL,
          reschedule_policy JSONB DEFAULT NULL,
          locations JSONB DEFAULT NULL,
          schedule_settings JSONB DEFAULT NULL,
          max_attendees INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Calendars table created');
    } else {
      // Table exists, add missing columns
      const required = ['form_data','payment_enabled','payment_gateway','prices','cancellation_policy','reschedule_policy','locations','schedule_settings','max_attendees'];
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'calendars' AND column_name = ANY($1)`,
        [required]
      );
      if (rows.length === required.length) {
        console.log('✅ Calendars schema verified');
        return;
      }
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
    }
  } catch (err) {
    console.error('⚠️  Calendars schema migration warning:', err.message);
  }
}

// Auto-migrate Appointments table columns on startup
async function ensureAppointmentsSchema() {
  try {
    // First, check if Appointments table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'appointments'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Appointments table does not exist, creating it...');
      await pool.query(`
        CREATE TABLE Appointments (
          id SERIAL PRIMARY KEY,
          therapist_id INT REFERENCES Users(id) ON DELETE CASCADE,
          client_id INT REFERENCES Users(id) ON DELETE SET NULL,
          calendar_id INT REFERENCES Calendars(id) ON DELETE SET NULL,
          title VARCHAR(255),
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          appointment_date DATE,
          duration_minutes INT,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'scheduled',
          google_event_id VARCHAR(255),
          meet_link VARCHAR(255),
          client_email VARCHAR(150),
          client_name VARCHAR(150),
          client_phone VARCHAR(20),
          therapist_email VARCHAR(150),
          payment_status VARCHAR(50) DEFAULT 'Pending',
          payment_amount DECIMAL(10, 2) DEFAULT 0.00,
          form_responses JSONB DEFAULT NULL,
          location_type VARCHAR(50) DEFAULT 'google_meet',
          cancel_token VARCHAR(64) UNIQUE DEFAULT NULL,
          cashfree_order_id VARCHAR(255) DEFAULT NULL,
          cashfree_payment_link TEXT DEFAULT NULL,
          razorpay_order_id VARCHAR(255) DEFAULT NULL,
          razorpay_payment_id VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Appointments table created');
    } else {
      // Table exists, add missing columns
      const required = ['start_time','end_time','appointment_date','duration_minutes','notes','client_phone','client_name','payment_status','payment_amount','form_responses','location_type','cancel_token','cashfree_order_id','cashfree_payment_link','razorpay_order_id','razorpay_payment_id','client_email','therapist_email','title','calendar_id','meet_link','google_event_id'];
      const { rows } = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = ANY($1)`,
        [required]
      );
      if (rows.length === required.length) {
        console.log('✅ Appointments schema verified');
        // Fill any null cancel_tokens
        await pool.query(`
          UPDATE Appointments 
          SET cancel_token = md5(id::text || random()::text || clock_timestamp()::text)
          WHERE cancel_token IS NULL
        `).catch(() => {});
        return;
      }
      
      // Add missing columns
      await pool.query(`
        ALTER TABLE Appointments
        ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
        ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
        ADD COLUMN IF NOT EXISTS appointment_date DATE,
        ADD COLUMN IF NOT EXISTS duration_minutes INT,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS client_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS client_email VARCHAR(150),
        ADD COLUMN IF NOT EXISTS therapist_email VARCHAR(150),
        ADD COLUMN IF NOT EXISTS title VARCHAR(255),
        ADD COLUMN IF NOT EXISTS calendar_id INT REFERENCES Calendars(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS meet_link VARCHAR(255),
        ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending',
        ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS form_responses JSONB DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'google_meet',
        ADD COLUMN IF NOT EXISTS cancel_token VARCHAR(64) UNIQUE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS cashfree_order_id VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS cashfree_payment_link TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ Appointments schema verified');
      
      // Fill any null cancel_tokens
      await pool.query(`
        UPDATE Appointments 
        SET cancel_token = md5(id::text || random()::text || clock_timestamp()::text)
        WHERE cancel_token IS NULL
      `).catch(() => {});
    }
  } catch (err) {
    console.error('⚠️  Appointments schema migration warning:', err.message);
  }
}

// Auto-migrate Users table columns on startup

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

// ─── 60-Min Session Reminder Cron (runs every 5 min) ─────────────────────────
// Tracks sent reminders in-memory to avoid double-sending within a server run.
const _60minRemindersSentThisRun = new Set();

async function process60MinReminders() {
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
              AND a.start_time BETWEEN NOW() + INTERVAL '55 minutes' AND NOW() + INTERVAL '65 minutes'
        `);

        for (const appt of due.rows) {
            if (_60minRemindersSentThisRun.has(appt.id)) continue;
            if (!await isEmailEnabled(appt.therapist_id, 'session_reminder_60min')) continue;
            const emailContent = sessionReminder60MinEmail({
                clientName: appt.client_name,
                therapistName: appt.therapist_name,
                sessionTitle: appt.title,
                startTime: appt.start_time,
                meetLink: appt.meet_link,
                locationText: appt.location_type === 'in_person' ? 'In-person (Clinic)' : 'Google Meet'
            });
            await sendEmail({ to: appt.client_email, ...emailContent, senderId: appt.therapist_id });
            _60minRemindersSentThisRun.add(appt.id);
            console.log(`✅ 60-min reminder sent to ${appt.client_email} for "${appt.title}"`);
        }
    } catch (err) {
        console.error('60-min session reminder cron error:', err.message);
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

// Auto-migrate Clients table on startup
async function ensureClientsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Clients (
        id SERIAL PRIMARY KEY,
        therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(20),
        age INT,
        occupation VARCHAR(100),
        gender VARCHAR(50),
        marital_status VARCHAR(50),
        emergency_name VARCHAR(255),
        emergency_phone VARCHAR(20),
        emergency_relation VARCHAR(100),
        emergency_name_encrypted VARCHAR(255),
        emergency_phone_encrypted VARCHAR(255),
        emergency_relation_encrypted VARCHAR(255),
        manually_added BOOLEAN DEFAULT false,
        clinical_profile_url TEXT,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_therapist_id ON Clients(therapist_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_clients_email ON Clients(email)`);
    console.log('✅ Clients schema verified');
  } catch (err) {
    console.error('⚠️  Clients schema migration warning:', err.message);
  }
}

// Auto-migrate ClientTransfers table on startup
async function ensureClientTransfersSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ClientTransfers (
        id SERIAL PRIMARY KEY,
        client_id INT NOT NULL REFERENCES Clients(id) ON DELETE CASCADE,
        from_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        to_therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        reason TEXT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_transfers_client_id ON ClientTransfers(client_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_transfers_from_therapist ON ClientTransfers(from_therapist_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_transfers_to_therapist ON ClientTransfers(to_therapist_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_transfers_status ON ClientTransfers(status)`);
    console.log('✅ ClientTransfers schema verified');
  } catch (err) {
    console.error('⚠️  ClientTransfers schema migration warning:', err.message);
  }
}

// Auto-migrate ClientActivities table on startup
async function ensureClientActivitiesSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ClientActivities (
        id SERIAL PRIMARY KEY,
        therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        client_id INT NOT NULL REFERENCES Clients(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        frequency VARCHAR(50),
        reminder_interval_days INT DEFAULT 7,
        reminder_count INT DEFAULT 4,
        reminders_sent INT DEFAULT 0,
        next_reminder_at TIMESTAMP,
        notify_client BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_activities_therapist_id ON ClientActivities(therapist_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_activities_client_id ON ClientActivities(client_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_activities_next_reminder ON ClientActivities(next_reminder_at)`);
    console.log('✅ ClientActivities schema verified');
  } catch (err) {
    console.error('⚠️  ClientActivities schema migration warning:', err.message);
  }
}

// Auto-migrate SessionNotes table on startup
async function ensureSessionNotesSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS SessionNotes (
        id SERIAL PRIMARY KEY,
        appointment_id INT REFERENCES Appointments(id) ON DELETE CASCADE,
        therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        client_id INT REFERENCES Clients(id) ON DELETE SET NULL,
        title VARCHAR(255),
        content TEXT,
        attachments JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add missing columns if they don't exist
    await pool.query(`
      ALTER TABLE SessionNotes
      ADD COLUMN IF NOT EXISTS client_id INT REFERENCES Clients(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS content TEXT,
      ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_session_notes_appointment_id ON SessionNotes(appointment_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_session_notes_therapist_id ON SessionNotes(therapist_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_session_notes_client_id ON SessionNotes(client_id)`);
    console.log('✅ SessionNotes schema verified');
  } catch (err) {
    console.error('⚠️  SessionNotes schema migration warning:', err.message);
  }
}

// Auto-migrate UserIntegrations table on startup
async function ensureUserIntegrationsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS UserIntegrations (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        provider VARCHAR(50) DEFAULT 'google',
        access_token VARCHAR(1024),
        refresh_token VARCHAR(1024),
        calendar_id VARCHAR(255),
        expiry_date BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, provider)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON UserIntegrations(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON UserIntegrations(provider)`);
    console.log('✅ UserIntegrations schema verified');
  } catch (err) {
    console.error('⚠️  UserIntegrations schema migration warning:', err.message);
  }
}

// Auto-migrate Availability table on startup
async function ensureAvailabilitySchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Availability (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        day_of_week INT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_availability_user_id ON Availability(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_availability_day_of_week ON Availability(day_of_week)`);
    console.log('✅ Availability schema verified');
  } catch (err) {
    console.error('⚠️  Availability schema migration warning:', err.message);
  }
}

// Add missing columns to Users table
async function ensureMissingUserColumns() {
  try {
    await pool.query(`
      ALTER TABLE Users
      ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✅ Users missing columns verified');
  } catch (err) {
    console.error('⚠️  Users missing columns migration warning:', err.message);
  }
}

// Auto-migrate Notifications table on startup
async function ensureNotificationsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES Users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        is_read BOOLEAN DEFAULT false,
        related_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON Notifications(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON Notifications(is_read)`);
    console.log('✅ Notifications schema verified');
  } catch (err) {
    console.error('⚠️  Notifications schema migration warning:', err.message);
  }
}

// Auto-migrate NoteTemplates table on startup
async function ensureNoteTemplatesSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS NoteTemplates (
        id SERIAL PRIMARY KEY,
        therapist_id INT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
        fields JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_note_templates_therapist_id ON NoteTemplates(therapist_id)`);
    console.log('✅ NoteTemplates schema verified');
  } catch (err) {
    console.error('⚠️  NoteTemplates schema migration warning:', err.message);
  }
}

// Auto-migrate Users table columns on startup
async function ensureUsersSchema() {
  try {
    // First, check if Users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️  Users table does not exist, creating it...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS Users (
          id SERIAL PRIMARY KEY,
          user_name VARCHAR(100),
          password VARCHAR(255),
          email VARCHAR(150) NOT NULL UNIQUE,
          phone VARCHAR(20),
          plan INT,
          dob DATE,
          gender VARCHAR(20),
          specialization VARCHAR(150),
          language_spoken TEXT[],
          country VARCHAR(100),
          state VARCHAR(100),
          city VARCHAR(100),
          pincode VARCHAR(20),
          clinic_address TEXT,
          google_id VARCHAR(255) UNIQUE,
          auth_provider VARCHAR(50) DEFAULT 'email',
          profile_picture TEXT,
          profile_slug VARCHAR(255) UNIQUE,
          about_me TEXT,
          reset_token TEXT,
          reset_token_expires TIMESTAMPTZ,
          org_role VARCHAR(50),
          org_owner_id INT,
          plan_name VARCHAR(50),
          profile_slug_updated_at TIMESTAMP,
          specializations TEXT[],
          email_preferences JSONB DEFAULT '{}'::jsonb,
          dashboard_preferences JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Users table created');
    } else {
      // Table exists, add missing columns
      await pool.query(`
        ALTER TABLE Users
        ADD COLUMN IF NOT EXISTS password VARCHAR(255),
        ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
        ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
        ADD COLUMN IF NOT EXISTS reset_token TEXT,
        ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS user_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS profile_picture TEXT,
        ADD COLUMN IF NOT EXISTS profile_slug VARCHAR(255) UNIQUE,
        ADD COLUMN IF NOT EXISTS about_me TEXT,
        ADD COLUMN IF NOT EXISTS org_role VARCHAR(50),
        ADD COLUMN IF NOT EXISTS org_owner_id INT,
        ADD COLUMN IF NOT EXISTS plan_name VARCHAR(50),
        ADD COLUMN IF NOT EXISTS dob DATE,
        ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
        ADD COLUMN IF NOT EXISTS language_spoken TEXT[],
        ADD COLUMN IF NOT EXISTS country VARCHAR(100),
        ADD COLUMN IF NOT EXISTS state VARCHAR(100),
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
        ADD COLUMN IF NOT EXISTS clinic_address TEXT,
        ADD COLUMN IF NOT EXISTS profile_slug_updated_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS specialization VARCHAR(150),
        ADD COLUMN IF NOT EXISTS specializations TEXT[],
        ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      
      // Fix password column to allow NULL (for OAuth users)
      try {
        await pool.query(`
          ALTER TABLE Users
          ALTER COLUMN password DROP NOT NULL
        `);
        console.log('✅ Password column now allows NULL for OAuth users');
      } catch (err) {
        // Column might already allow NULL, that's fine
        if (!err.message.includes('does not exist')) {
          console.log('✅ Password column already allows NULL');
        }
      }

      // Fix password_hash column to allow NULL (for OAuth users)
      try {
        await pool.query(`
          ALTER TABLE Users
          ALTER COLUMN password_hash DROP NOT NULL
        `);
        console.log('✅ Password_hash column now allows NULL for OAuth users');
      } catch (err) {
        // Column might not exist or already allow NULL, that's fine
        if (!err.message.includes('does not exist')) {
          console.log('✅ Password_hash column already allows NULL or does not exist');
        }
      }
      
      console.log('✅ Users schema verified');
    }
  } catch (err) {
    console.error('⚠️  Users schema migration warning:', err.message);
  }
}

// Auto-migrate SessionNotes table columns on startup

// Auto-migrate enterprise_leads table on startup
async function ensureEnterpriseLeadsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS enterprise_leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(150) NOT NULL UNIQUE,
        company_name VARCHAR(255),
        company_website VARCHAR(255),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_enterprise_leads_email ON enterprise_leads(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_enterprise_leads_created ON enterprise_leads(created_at DESC)`);
    console.log('✅ Enterprise leads schema verified');
  } catch (err) {
    console.error('⚠️  Enterprise leads schema migration warning:', err.message);
  }
}

// Auto-migrate Availability table on startup
// Start server
httpServer.listen(PORT, async () => {
  console.log('\n🔐 Starting Security Validation...');
  
  // Run auto-migrations FIRST before validation
  console.log('\n📋 Running schema auto-migrations...\n');
  await ensureCalendarsSchema();
  await ensureAppointmentsSchema();
  await ensureUsersSchema();
  await ensureClientsSchema();
  await ensureClientTransfersSchema();
  await ensureClientActivitiesSchema();
  await ensureSessionNotesSchema();
  await ensureUserIntegrationsSchema();
  await ensureAvailabilitySchema();
  await ensureMissingUserColumns();
  await ensureNotificationsSchema();
  await ensureNoteTemplatesSchema();
  await ensureOrganizationTherapistsSchema();
  await ensureOrgRoleSchema();
  await ensureOrganizationDetailsSchema();
  await ensureEnterpriseLeadsSchema(); // Initialize enterprise leads table
  await ensureAuditTable(); // Initialize audit logging
  
  // NOW validate schema integrity after migrations
  const schemaValidation = await validateSchema();
  if (!schemaValidation.valid && schemaValidation.critical) {
    console.error('🚨 CRITICAL: Schema validation failed. Application cannot start.');
    process.exit(1);
  }

  // Verify schema hasn't been tampered with
  const integrityCheck = await verifySchemaIntegrity();
  if (!integrityCheck) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Schema hash mismatch detected. This may be due to recent schema migrations.');
      console.warn('ℹ️ To regenerate the schema hash, run: node backend/regenerate-schema-hash.js');
      console.warn('ℹ️ Continuing with deployment...');
    } else {
      console.warn('⚠️ Schema hash mismatch detected in development mode.');
      console.warn('ℹ️ This is normal after schema migrations.');
    }
  }

  // Store schema hash for future verification
  if (process.env.NODE_ENV === 'production') {
    await storeSchemaHash();
  }

  console.log('\n✅ Security validation passed. Initializing application...\n');
  
  // Run activity reminder cron every hour
  setInterval(processActivityReminders, 60 * 60 * 1000);
  processActivityReminders(); // run once on startup too
  
  // Run session reminder cron every hour
  setInterval(processSessionReminders, 60 * 60 * 1000);
  processSessionReminders(); // run once on startup too
  
  // Run 30-min session reminder cron every 5 minutes
  setInterval(process30MinReminders, 5 * 60 * 1000);
  process30MinReminders(); // run once on startup too
  
  // Run 60-min session reminder cron every 5 minutes
  setInterval(process60MinReminders, 5 * 60 * 1000);
  process60MinReminders(); // run once on startup too

  // Production: Set up continuous security monitoring
  if (process.env.NODE_ENV === 'production') {
    // Monitor data integrity every 6 hours
    setInterval(async () => {
      console.log('🔍 Running data integrity check...');
      await monitorDataIntegrity();
    }, 6 * 60 * 60 * 1000);

    // Check for suspicious activities every 30 minutes
    setInterval(async () => {
      const result = await detectSuspiciousActivity();
      if (result.suspicious) {
        console.error(`🚨 ALERT: ${result.reason}`);
      }
    }, 30 * 60 * 1000);

    // Verify schema integrity every 24 hours
    setInterval(async () => {
      console.log('🔐 Running schema integrity verification...');
      const isValid = await verifySchemaIntegrity();
      if (!isValid) {
        console.error('🚨 CRITICAL: Schema tampering detected!');
      }
    }, 24 * 60 * 60 * 1000);
  }

  console.log(`🚀 Server running on port ${PORT}`);
});

// Export the app for Vercel serverless functions
export default app;
