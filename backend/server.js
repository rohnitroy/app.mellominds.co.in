import './config/env.js'; // MUST be first
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import passport from './config/passport.js';
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
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/calendars', calendarRoutes);
app.use('/api/connect-calendar', connectCalendarRoutes);
app.use('/api/connect-calendar', connectCalendarRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/availability', availabilityRoutes);

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Export the app for Vercel serverless functions
export default app;
