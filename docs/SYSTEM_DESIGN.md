# MelloMinds — System Design & Architecture

**Last Updated:** June 5, 2026  
**Audience:** Developers, Architects, DevOps  
**Purpose:** Explain architectural decisions, data flows, and integration patterns

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack](#technology-stack)
3. [System Components](#system-components)
4. [Data Flow Patterns](#data-flow-patterns)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [Database Design](#database-design)
8. [Security Architecture](#security-architecture)
9. [Payment System Design](#payment-system-design)
10. [Real-Time Communication](#real-time-communication)
11. [Error Handling & Resilience](#error-handling--resilience)
12. [Scalability & Performance](#scalability--performance)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTS (Public)                        │
│         (Public Booking Page / Confirmation Page)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTPS / REST API
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────▼──────────────────┐     ┌───────▼──────────────────┐
│  FRONTEND (React/TS)     │     │  PAYMENT GATEWAYS        │
│  ├─ Dashboard            │     │  ├─ Razorpay (client)   │
│  ├─ Booking              │     │  └─ Cashfree (client)   │
│  ├─ Payments             │     └──────────────────────────┘
│  └─ Settings             │
└────────┬────────────────┘
         │
         │ Socket.io + REST API
         │
┌────────▼────────────────────────────────┐
│       BACKEND (Node.js/Express)         │
│  ├─ Auth (Passport + OAuth)             │
│  ├─ API Routes (20+ modules)            │
│  ├─ Business Logic                      │
│  ├─ PG Integration (HTTP fetch)         │
│  └─ Email System (Resend)               │
└────────┬────────────────────────────────┘
         │
    ┌────┴───────┬────────────┬───────────┐
    │            │            │           │
    │            │            │           │
┌───▼────┐  ┌────▼────┐  ┌────▼────┐  ┌──▼──────┐
│ PSQL   │  │Google   │  │Cloud-   │  │Resend  │
│ Database│  │Calendar │  │inary    │  │Email   │
└────────┘  │ API     │  │Images   │  └────────┘
            └─────────┘  └─────────┘
```

**Key Principle:** Client-agnostic booking system where therapists bring their own payment gateway accounts.

---

## Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Router:** React Router DOM v7
- **Table Library:** TanStack React Table v8
- **HTTP Client:** Fetch API (no Axios)
- **Real-Time:** Socket.io Client v4
- **Icons:** React Iconly v2
- **Build:** React Scripts + Vite (dev)
- **Deployment:** Vercel

### Backend
- **Runtime:** Node.js 18+ (ESM modules)
- **Framework:** Express.js
- **Auth:** Passport.js (local + Google OAuth2)
- **Session:** express-session + PostgreSQL store
- **Database:** PostgreSQL (pg client)
- **Real-Time:** Socket.io v4 (server)
- **Email:** Nodemailer + Resend
- **Security:** Helmet, CORS, Rate-Limit
- **File Upload:** Multer (profile pictures)
- **Images:** Cloudinary API
- **Encryption:** Node.js crypto

### Database
- **Engine:** PostgreSQL 14+
- **Session Store:** PostgreSQL (pg-simple)
- **Format:** SQL (migrations in `backend/scripts/`)

### External Services
- **Calendar Sync:** Google Calendar API (OAuth2)
- **Payment (Aggregator):** Razorpay + Cashfree (therapist-owned)
- **Images:** Cloudinary
- **Email:** Resend (transactional)

---

## System Components

### 1. Authentication & Authorization

**Component:** Passport.js + express-session

**Flows:**
- **Email/Password:** bcrypt hashing, session creation
- **Google OAuth2:** External identity provider, auto-linking by email
- **Session Management:** Server-side PostgreSQL store, 8-hour cookie
- **Route Protection:** Middleware `req.isAuthenticated()` check

**Key Files:**
- `backend/config/passport.js` — Passport strategies
- `backend/routes/auth.js` — Auth endpoints
- `backend/server.js` — Session config

**Design Decision:** Session-based auth (not JWT) because:
- Server-side revocation support (logout works immediately)
- CSRF protection via cookies
- Simpler for traditional web apps

---

### 2. Frontend Application

**Architecture:** React Single-Page App with client-side routing

**Main Components:**
- `App.tsx` — Router, theme, global state
- `MyProfile.tsx` — Therapist profile editor
- `MySettings.tsx` — Settings (integrations, plan upgrade)
- `Appointments.tsx` — Booking management + refunds
- `PaymentsInvoice.tsx` — Payment dashboard
- `ClientView.tsx` — Client profile details
- `TherapistProfileView.tsx` — Public booking page
- `UpgradePlanModal.tsx` — Plan selection UI

**State Management:** React hooks (useState, useEffect) + localStorage for temporary data

**Key Pattern:** Fetch API directly from components, minimal abstraction layer

---

### 3. Backend API Routes

**Organization:** Modular route files in `backend/routes/`

**Modules (20+):**
| Module | Purpose |
|---|---|
| auth.js | Registration, login, OAuth, logout |
| users.js | Profile update, settings |
| calendars.js | Create/edit/delete booking calendars |
| bookings.js | Book session, update status, refunds, reports |
| clients.js | Client CRUD, transfer |
| notes.js | Session notes, templates, file uploads |
| activities.js | Homework/activities, reminders |
| availability.js | Weekly schedule, slot calculation |
| razorpay.js | Razorpay account connection, payment flow |
| cashfree.js | Cashfree account connection, payment flow |
| notifications.js | In-app notification retrieval |
| email-preferences.js | Reminder email config |
| profile-link.js | Custom profile URL |
| connect_calendar.js | Google Calendar OAuth |
| enterprise.js | Enterprise lead form |
| publicProfile.js | Public-facing therapist profile |
| therapists.js | Therapist discovery (if needed) |
| gmail.js | Gmail OAuth (session reminders) |

**Design Pattern:** Each route file is independent, imports from `backend/lib/` for shared utilities

---

### 4. Utility Libraries

**Location:** `backend/lib/`

| File | Purpose |
|---|---|
| email.js | Email template rendering, sending (Resend API) |
| audit.js | Request logging middleware, audit trail |
| encryption.js | Encrypt/decrypt sensitive data (payment credentials) |
| notifications.js | In-app notification creation |
| socket.js | Socket.io instance getter/setter |
| googleAuth.js | Google API helpers (Calendar, OAuth) |

**Design:** Utilities are stateless functions; state (like Socket.io) exported via getter/setter

---

### 5. Configuration

**Location:** `backend/config/`

| File | Purpose |
|---|---|
| env.js | Environment variable validation on startup |
| database.js | PostgreSQL connection pool |
| passport.js | Passport strategy setup (local + Google) |
| cloudinary.js | Cloudinary image upload config |

**Design Decision:** Config files initialize once at startup; connection pools are reused

---

## Data Flow Patterns

### Pattern 1: Public Booking (No Payment)

```
Client                      Frontend                Backend              Database
 │                              │                      │                    │
 ├─── Fill form ──────────────→ │                      │                    │
 │                              │                      │                    │
 │                              ├─ POST /bookings/public ──────────────────→ │
 │                              │                      │                    │
 │                              │                      ├─ Insert appointment │
 │                              │                      │                    │
 │                              │                      ├─ Sync Google Calendar
 │                              │                      │                    │
 │                              │                      ├─ Create notification
 │                              │                      │                    │
 │                              │ ← 200 + appointment  │                    │
 │                              │                      │                    │
 │ ← Confirmation page ←────────│                      │                    │
```

**Key Points:**
1. No authentication required for booking
2. Idempotency: check if `cashfree_order_id` exists before creating
3. Email notifications are fire-and-forget (async)
4. Google Calendar sync is non-blocking

---

### Pattern 2: Cashfree Payment Flow

```
Client                   Frontend              Backend           Cashfree SDK/API
 │                           │                    │                    │
 ├─ Select session ──────────→ │                   │                    │
 │                           │                    │                    │
 │                           ├─ POST /cashfree/create-order ─────────→ │
 │                           │                    │                    │
 │                           │                    ├─ Validate amount   │
 │                           │                    │                    │
 │                           │                    ├─ Fetch PG creds    │
 │                           │                    │                    │
 │                           │ ← paymentSessionId  │                    │
 │                           │ ← 200 order created │                    │
 │                           │                    │                    │
 │ ← paymentSessionId ←──────│                    │                    │
 │                           │                    │                    │
 ├─ cashfree.checkout({}) ────────────────────────────────────────────→ │
 │                                                        (redirects to UI)
 │
 ├─ Enter card details ──────────────────────────→ │
 │                                         (Cashfree handles)
 │
 ├─ Payment success ─────────────────────────────→ │
 │                                                 │
 │ ← Redirect to /booking-status?order_id=... ←──│
 │
 └─ BookingStatus.tsx calls POST /bookings/public ─→ │
                                                      │
                                                      ├─ Create appointment
                                                      ├─ Mark payment_status = Pending
                                                      ├─ Emit Socket.io event
                                                      │
                                                      ← Webhook from Cashfree
                                                      (async) verifies signature
                                                      Updates payment_status = Paid
```

**Key Points:**
1. Client-side SDK integration (Cashfree JS library)
2. Server creates order with therapist's credentials
3. Idempotency via `cashfree_order_id` unique constraint
4. Payment status verified via webhook (async)
5. Double-booking prevented by `cancel_token` tracking

---

### Pattern 3: Real-Time Notifications (Socket.io)

```
Backend (event triggered)           Socket.io Server              Client Browser
 │                                      │                             │
 ├─ Session booked ─────────────────────→ │                             │
 │ (emit to user:123)                    │                             │
 │                                      ├─ Push to room:user:123 ──→ │
 │                                      │                             │
 │                                      │                             ├─ Toast popup
 │                                      │                             │
 │                                      │                             ├─ Refetch data
```

**Usage:**
- New bookings
- Payment status change
- Refund processed
- Activity/homework assigned

**Implementation:** `setIO(io)` in server.js, imported via `socket.js` getter

---

## Frontend Architecture

### Component Hierarchy

```
App.tsx
├─ Router (React Router v7)
│  ├─ ProtectedRoute
│  │  ├─ Appointments.tsx
│  │  ├─ ClientView.tsx
│  │  ├─ MyProfile.tsx
│  │  ├─ MySettings.tsx
│  │  └─ PaymentsInvoice.tsx
│  │
│  ├─ PublicRoute
│  │  ├─ TherapistProfileView.tsx (public booking page)
│  │  └─ BookingStatus.tsx (post-payment redirect)
│  │
│  └─ LoginPage, RegisterPage, etc.
│
├─ API Config (config/api.js)
├─ Socket.io Client Setup
└─ Global State (theme, user)
```

### Key Patterns

**1. Fetch API Pattern**
```javascript
const response = await fetch(`${API_BASE_URL}/api/bookings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
const result = await response.json();
```

**Why:** No SDK overhead, transparent network calls, easy to debug

**2. State Management**
- Per-component `useState` for form data
- `useEffect` for API calls
- `useRef` for preventing double-fires (React StrictMode)
- No Redux/Context for now (simple enough)

**3. Modal Patterns**
- `UpgradePlanModal` — Plan selection
- `AvailabilityModal` — Availability editing
- `CreateCalendarModal` — Create booking calendar
- Modals are conditionally rendered based on boolean state

**4. Real-Time Updates via Socket.io**
```javascript
useEffect(() => {
  const socket = io(API_BASE_URL);
  socket.emit('join', userId);
  socket.on('booking:new', () => refetchBookings());
  return () => socket.disconnect();
}, []);
```

---

## Backend Architecture

### Request Lifecycle

```
Client Request
    │
    ├─ Trust Proxy (for rate limit on Render)
    │
    ├─ Helmet (security headers)
    │
    ├─ Body Parser (JSON/form-data)
    │
    ├─ CORS Middleware
    │
    ├─ Session Setup (express-session)
    │
    ├─ Passport Initialize
    │
    ├─ Audit Middleware (log request)
    │
    ├─ Rate Limiter (auth or general)
    │
    ├─ Route Handler
    │  ├─ Validate input
    │  ├─ Check auth (req.isAuthenticated())
    │  ├─ Check plan (req.user.plan_name)
    │  ├─ Execute business logic
    │  ├─ Emit Socket.io events
    │  └─ Send response
    │
    └─ Global Error Handler (catch unhandled errors)
```

### Middleware Stack (server.js)

| Middleware | Purpose |
|---|---|
| helmet() | Security headers (CSP, HSTS, etc.) |
| express.json() | JSON body parser (50KB limit) |
| cors() | Cross-Origin Resource Sharing |
| session() | Server-side session management |
| passport.initialize() | Passport auth setup |
| auditMiddleware | Request logging |
| rateLimit() | DDoS protection |

---

## Database Design

### Core Tables

**Users**
- Therapist accounts
- Google OAuth linking
- Profile data (name, email, specialization, location)
- Plan assignment (plan_name column)
- Profile picture (Cloudinary URL)

**Calendars**
- Booking service types (one-on-one / group / couples)
- Payment configuration (prices JSONB, cancellation_policy JSONB)
- Availability rules (schedule_settings JSONB)
- Public slug for booking page

**Appointments**
- Individual sessions booked
- Status tracking (scheduled, completed, cancelled, noshow)
- Payment fields (amount, payment_status, payment_gateway, order IDs)
- Google Calendar integration (event_id, meet_link)

**Clients**
- Client profiles (name, email, phone, notes)
- Therapist-owned (therapist_id FK)

**UserIntegrations**
- OAuth tokens (Google Calendar, Gmail, etc.)
- Payment gateway credentials (Razorpay, Cashfree — encrypted JSONB)
- Per-therapist PG account configuration

**RefundTracking**
- Audit trail of all refunds
- Amount, reason, timestamp
- Full vs. partial refund tracking

**Other Tables:**
- SessionNotes, NoteTemplates, ClientActivities, Availability, Notifications, etc.

### JSONB Fields (Flexible Schema)

**calendars.prices:**
```json
[
  { "label": "Standard", "amount": 1000, "currency": "INR" },
  { "label": "Extended", "amount": 1500, "currency": "INR" }
]
```

**calendars.cancellation_policy:**
```json
{
  "enabled": true,
  "window": 24,
  "unit": "hours",
  "refund_type": "percentage",
  "refund_percentage": 100
}
```

**user_integrations.razorpay_config:**
```json
{
  "key_id": "encrypted_key",
  "key_secret": "encrypted_secret",
  "connected_at": "2026-06-05T10:00:00Z",
  "account_id": "123456"
}
```

### Encryption Strategy

- Sensitive fields (PG credentials) stored encrypted in JSONB
- Encryption key: `process.env.ENCRYPTION_MASTER_SECRET` (32+ char)
- Decryption on-demand when forming API calls
- Never log or return encrypted values to frontend

---

## Security Architecture

### 1. Authentication & Session

**Mechanism:** Passport.js + express-session + PostgreSQL

**Session Cookie:**
- `httpOnly: true` — prevents XSS token theft
- `secure: true` (production) — HTTPS only
- `sameSite: none` (production) — cross-origin allowed
- Max age: 8 hours
- Domain: `.mellominds.co.in` (production)

**Protection Against:**
- Session fixation: Session ID regenerated on login
- CSRF: Cookie-based (SameSite attribute)
- XSS: httpOnly cookie

---

### 2. Rate Limiting

**Endpoints:**
- `/auth/*` — 20 requests / 15 minutes per IP
- `/api/*` — 200 requests / 15 minutes per IP
- Disabled in development

**Protection:** Brute-force attacks, bot spam

---

### 3. Input Validation

**Strategy:** Minimal but critical validation at route level

**Payment-specific:**
- Amount range: 1 to 10,000,000,000 paise (₹0.01 to ₹100,000,000)
- Prevention: Client-side amount tampering (server re-validates)

**Database:**
- CHECK constraints on enums (plan_name, status, etc.)
- UNIQUE constraints (email, slug, etc.)

---

### 4. Payment Gateway Security

**Signature Verification:**
```
On webhook receive:
1. Extract signature from request header
2. Reconstruct payload as per PG spec
3. HMAC-SHA256 using PG secret key
4. Compare signatures — reject if mismatch
```

**Credential Storage:**
- Encrypted in `user_integrations.razorpay_config` JSONB
- Decrypted only when creating payment order
- Never logged, never returned to frontend

**Idempotency:**
- `order_id` checked before creating appointment
- Prevents double-booking on page refresh

---

### 5. Data Integrity

**Checks:**
- `req.user.id` used for all queries (therapist isolation)
- Foreign key constraints (ON DELETE CASCADE/SET NULL)
- Audit trail (audit middleware logs all requests)

**Protection:** SQL injection (pg parameterized queries), data leakage

---

## Payment System Design

### Aggregator Model

**Architecture:**
```
Client  ──(book)──>  MelloMinds  ──(order)──>  Razorpay/Cashfree
                        ↑                            │
                        └─────(payment)──────────────┘
                                ↓
                        Therapist Account
                        (money lands here)
```

**Key Design:**
1. Therapist connects THEIR payment gateway account to MelloMinds
2. MelloMinds stores encrypted credentials per therapist
3. When client books, order created using therapist's credentials
4. Money settles directly to therapist's bank account
5. MelloMinds never touches payment data (no PCI burden)

### Payment Order Creation Flow

```
POST /api/cashfree/create-order
├─ Input: calendar_id, price_id, client_email
│
├─ Validate
│  ├─ User authenticated
│  ├─ User has Individual/Team plan
│  ├─ Amount in valid range
│  └─ Calendar exists & belongs to user
│
├─ Fetch PG credentials (decrypt)
│
├─ Call Cashfree API (HTTP fetch)
│  ├─ Include therapist's key_id
│  ├─ Get paymentSessionId
│  └─ Store in DB
│
└─ Return { paymentSessionId, order_id }
```

### Payment Status Verification

**Webhook Approach:**
- Cashfree/Razorpay sends webhook after payment
- Signature verified (HMAC-SHA256)
- Appointment marked as Paid
- Therapist notified (in-app + Socket.io)

**Fallback (Manual Verification):**
- If webhook delayed, frontend can poll `/api/bookings/:id`
- Shows payment_status field

### Refund Flow

```
Therapist clicks Refund button
├─ Input: booking_id, refund_amount
│
├─ Validate
│  ├─ Booking exists
│  ├─ Booking belongs to therapist
│  ├─ Payment already received
│  └─ Refund amount ≤ paid amount
│
├─ Check Cancellation Policy
│  ├─ If refund_type = percentage, apply percentage
│  └─ Calculate actual refund amount
│
├─ Call Razorpay/Cashfree API (refund)
│  ├─ Use therapist's credentials
│  ├─ Get refund_id
│  └─ Store in RefundTracking table
│
├─ Update Appointment (payment_status = Refunded or Partial Refund)
│
├─ Send Email to Client
│  ├─ Refund amount
│  ├─ Timeline (3-5 business days)
│  └─ Transaction ID
│
└─ Emit Socket.io event to therapist
```

---

## Real-Time Communication

### Socket.io Server Setup

**Initialization:** `server.js` creates HTTP server + Socket.io instance

**CORS Configuration:**
```javascript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
  }
});
```

**Room-Based Broadcasting:**
```javascript
io.to(`user:${therapistId}`).emit('booking:new', appointmentData);
io.to(`user:${therapistId}`).emit('payment:confirmed', paymentData);
```

### Events Emitted

| Event | Trigger | Receiver |
|---|---|---|
| booking:new | Client books session | Therapist |
| booking:status-change | Therapist cancels | Therapist + Client |
| payment:confirmed | Payment webhook received | Therapist |
| refund:processed | Refund completed | Therapist |
| activity:assigned | Homework assigned | Client |
| notification:new | Any action | Relevant user |

### Client-Side Socket.io

**Connection:**
```javascript
const socket = io(API_BASE_URL, { withCredentials: true });
socket.emit('join', userId);
```

**Listeners:**
```javascript
socket.on('booking:new', () => refetchBookings());
socket.on('payment:confirmed', () => showSuccessToast());
```

---

## Error Handling & Resilience

### Backend Error Handler

**Global Catch Block:**
```javascript
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  
  if (err.name === 'TokenError') {
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed_token`);
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'Something went wrong'
  });
});
```

**Design:** Centralized error logging, user-friendly messages in production

### Payment Error Handling

**handlePaymentError() Helper:**
```javascript
const errors = {
  'INVALID_MERCHANT': 'Payment gateway configuration error',
  'INVALID_REQUEST': 'Invalid payment request',
  'PAYMENT_FAILED': 'Payment processing failed',
  // ... mapped to user-friendly messages
};
```

**Retry Strategy:**
- Webhook retries (PG handles)
- Manual verification if webhook delayed
- Idempotency prevents double-charging

### Validation Errors

**Input Validation:**
```javascript
if (!amount || amount < 1 || amount > 10000000000) {
  return res.status(400).json({ error: 'Invalid payment amount' });
}
```

**Business Logic Validation:**
```javascript
if (req.user.plan_name === 'free') {
  return res.status(403).json({ error: 'Payment gateway not available in Free plan' });
}
```

---

## Scalability & Performance

### Horizontal Scaling

**Stateless Design:**
- Backend is stateless (except session store in DB)
- Multiple backend instances can run simultaneously
- Session store in PostgreSQL allows session sharing

**Load Balancing:**
- Frontend on Vercel (CDN, auto-scaling)
- Backend on Node (can deploy to multiple servers)
- PostgreSQL as single source of truth

### Database Optimization

**Indexes:**
- PK on all tables (auto-created)
- FK relationships (for joins)
- Potential: Add index on `appointments.start_time` for slot queries
- JSONB field `prices` is read-only (no indexing needed)

**Connection Pooling:**
- `pg.Pool` with default 10 connections
- Reused across all routes
- Configurable via `pool.js`

### Caching Strategy

**Currently:** No caching layer

**Future:** Could add:
- Redis for session store (instead of PostgreSQL)
- Cache therapist calendars (TTL 1 hour)
- Cache availability slots (invalidate on edit)

### Rate Limiting

**Current:** Express-rate-limit with in-memory store

**Future (Production):**
- Redis-backed rate limiter for distributed systems
- Per-user rate limits (vs. per-IP)

---

## Deployment Architecture

### Frontend (Vercel)

```
Git Push
  ↓
Vercel CI/CD
  ├─ npm install
  ├─ npm run build
  ├─ Type checking (TypeScript)
  └─ Deploy to CDN
  
Live at: mellominds.co.in
```

### Backend (Render / Railway)

```
Git Push
  ↓
Render CI/CD
  ├─ npm install
  ├─ npm run start (prod) or npm run dev
  ├─ Auto-migrate tables (server.js startup)
  └─ Start listening on :3001

Live at: api.mellominds.co.in or :3001
```

### Database (Managed PostgreSQL)

- AWS RDS / Railway Postgres
- Automatic backups
- TLS encryption in transit
- Connection via SSL

### Environment Variables

**Backend (.env):**
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/mellominds
SESSION_SECRET=<32+ chars>
ENCRYPTION_MASTER_SECRET=<32+ chars>
FRONTEND_URL=https://mellominds.co.in
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
CLOUDINARY_API_KEY=xxx
RESEND_API_KEY=xxx
```

**Frontend (.env):**
```
VITE_API_BASE_URL=https://api.mellominds.co.in
VITE_ENVIRONMENT=production
```

---

## Monitoring & Observability

### Logging

**Backend Logs:**
- Request/response via audit middleware
- Errors via console.error()
- Deployment logs on Render dashboard

**Frontend Logs:**
- Browser console (errors, warnings)
- Sentry (if integrated) for error tracking

### Health Check

- `GET /health` returns `{ status: 'OK' }`
- Used by load balancer to verify server alive

### Metrics (Future)

Could integrate:
- Prometheus for metrics collection
- Grafana for dashboarding
- Alert on payment failure spike

---

## Key Design Decisions & Rationale

| Decision | Rationale | Trade-Off |
|---|---|---|
| Aggregator Model | Avoid PCI compliance, regulatory burden | More onboarding friction |
| Session-Based Auth | Server-side revocation, CSRF built-in | Cannot revoke tokens instantly for compromised sessions (8h TTL) |
| JSONB for Dynamic Data | Flexible schema, no migrations | Less structured, need app-level validation |
| Direct HTTP Fetch | No SDK bloat, simpler debugging | Manual signature verification |
| Socket.io for Real-Time | Live notifications, better UX | Added infrastructure, WebSocket overhead |
| PostgreSQL + Custom Pool | Stateless design, easy horizontal scaling | No ORM, manual SQL queries |
| Encrypted Credentials in DB | Simple, no separate vault service | Key rotation is manual |

---

**For questions about specific flows, trace the code in `backend/routes/` or `frontend/src/`.**
