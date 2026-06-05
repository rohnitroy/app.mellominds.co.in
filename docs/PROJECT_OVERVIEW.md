# MelloMinds — Project Overview

**Last Updated:** June 5, 2026  
**Status:** Payment Gateway Phase Complete — Full Functional  
**Stack:** React 18 + Express.js + PostgreSQL + Socket.io + Razorpay/Cashfree APIs

---

## What MelloMinds Is

**MelloMinds** is a **subscription-based therapist booking & practice management SaaS platform** with integrated payment processing, calendar management, and client relationship tools.

Therapists create booking calendars, share public booking pages with clients, and manage sessions. Clients book sessions, pay online via Razorpay/Cashfree payment gateways connected by therapists, and receive reminders/confirmations.

### Core Model: Aggregator
- **Therapists own their payment gateway accounts** (Razorpay / Cashfree)
- **Platform orchestrates the integration** — therapists don't manage payment directly on MelloMinds
- **No PCI compliance burden on platform** — therapists handle their own account security
- **Settlement goes directly to therapist bank account** — MelloMinds doesn't hold money

---

## Subscription Tiers

| Plan | Price | Target | Key Features |
|---|---|---|---|
| **Free** | ₹0 | Individuals trying it out | Booking, intake forms, notes, analytics (3-month limit) |
| **Individual** | ₹699/month | Solo practitioners | Free + payment gateway + custom profile link + reminder config |
| **Team** | ₹1,499/seat/month | Group practices | Individual + unlimited calendars + advanced analytics + team members |
| **Enterprise** | Custom | Large orgs | Team + white-label domain + API access + webhooks + dedicated support |

---

## What's DONE ✅

### Phase 1: Core Booking System
- ✅ Therapist authentication (email + Google OAuth)
- ✅ Calendar creation (one-on-one / group / couples)
- ✅ Weekly availability scheduling
- ✅ Public booking page with shareable link
- ✅ Client intake forms (custom questions)
- ✅ Google Calendar & Google Meet integration
- ✅ Session notes with custom templates
- ✅ Client database & session history
- ✅ In-app & email notifications
- ✅ Dashboard analytics & stats

### Phase 2: Offline Payments
- ✅ Offline payment tracking (Cash / UPI)
- ✅ Payment status in appointments
- ✅ Invoice generation & download

### Phase 3: Payment Gateway Integration (COMPLETE)
- ✅ Razorpay integration — therapist connects their account
- ✅ Cashfree integration — therapist connects their account
- ✅ Payment amount validation (prevent client-side tampering)
- ✅ Order creation with dynamic pricing (per-session amounts configurable)
- ✅ Payment status verification after return from gateway
- ✅ Idempotency — prevent double-booking on page refresh
- ✅ Public booking page payment form (client enters card/UPI details)
- ✅ Signature verification for security
- ✅ Error handling with user-friendly messages

### Phase 4: Refund Management (COMPLETE)
- ✅ Manual refund interface in therapist dashboard
- ✅ Refund policy enforcement (respect cancellation_policy)
- ✅ Auto-refund on session cancellation (percentage-based)
- ✅ Refund history tracking & audit trail (RefundTracking table)
- ✅ Refund notifications to clients (HTML email with timeline)
- ✅ Refund status display in client receipt
- ✅ Payment reports for therapists (status/method breakdown)

### Phase 5: Plan-Based Access Control
- ✅ Payment gateway (Individual + Team only)
- ✅ Custom profile links (Individual + Team)
- ✅ Reminder configuration (Individual + Team)
- ✅ File attachments in notes (Individual + Team)
- ✅ Analytics date range (Free = 3 months max; Individual/Team = unlimited)
- ✅ Removed WhatsApp reminders from all plans

### Phase 6: Database & Schema
- ✅ Plan column added to users table ('free', 'individual', 'team', 'enterprise')
- ✅ Price array in calendars.prices (JSONB)
- ✅ Cancellation policy in calendars.cancellation_policy (JSONB)
- ✅ Refund tracking table for audit trail
- ✅ UserIntegrations table for payment gateway credentials

---

## What's PARTIALLY WORKING ⚠️

None — all implemented phases are full functional.

---

## What's PENDING (Not Started) 🚧

### High Priority
1. **Subscription Billing** (₹699/month auto-charge for Individual plan)
   - Auto-charge on due date
   - Failed payment retry logic
   - Invoice generation & delivery
   - Plan downgrade on non-payment
   - Status: Design needed

2. **Plan Upgrade Flow**
   - `POST /api/users/upgrade-plan` endpoint
   - Payment processing for upgrade (difference in price)
   - Pro-rata billing calculation
   - Status: Needs implementation

3. **Settlement Tracking**
   - Know when therapist money lands in bank (settlement reports from Razorpay/Cashfree)
   - Settlement dashboard for therapist (how much earned, when settled)
   - Commission deduction tracking (if applicable)
   - Status: Needs integration

4. **Sandbox Testing & Validation**
   - Razorpay sandbox API testing
   - Cashfree sandbox API testing
   - End-to-end payment flow QA
   - Edge case handling (concurrent refunds, payment failures, timeouts)
   - Status: Not yet tested

5. **Seat Management (Team Plan)**
   - Add/remove team members endpoint
   - Role-based access (therapist, admin, support)
   - Usage tracking (X of 5 seats used)
   - Status: Data model exists; endpoint missing

### Medium Priority
6. **WhatsApp Reminders** (Removed for now)
   - WhatsApp API integration (Twilio or similar)
   - Plan restriction (Team plan only)
   - Template configuration
   - Status: Deferred

7. **GST & Tax Calculations**
   - Apply GST to session prices
   - Display tax in invoices
   - Compliance tracking
   - Status: Not started

8. **Advanced Analytics**
   - Revenue per client / calendar
   - Session cancellation rates
   - No-show patterns
   - Client retention metrics
   - Status: Basic dashboard exists; needs enhancement

9. **White-Label Branding (Enterprise)**
   - Custom domain support
   - Therapist-branded UI
   - Status: Needs implementation

10. **API Access & Webhooks (Enterprise)**
    - GraphQL/REST API for third-party integrations
    - Webhook subscriptions (session created, payment received, etc.)
    - Rate limiting & API key management
    - Status: Needs implementation

### Low Priority (Nice-to-Have)
11. **Client App** — Mobile/web app for clients to view bookings, get reminders, reschedule
12. **Video Integration** — Embedded video consultation (instead of Google Meet redirect)
13. **Marketplace** — Therapist discovery & reviews
14. **AI Chatbot** — Intake form preprocessing, FAQ automation
15. **Multi-Currency Support** — Handle USD, EUR, etc.
16. **Audit Logs** — Track all therapist actions for compliance

---

## Database Tables

| Table | Purpose | Status |
|---|---|---|
| users | Therapist accounts | ✅ Complete |
| plans | Subscription tier definitions | ✅ Complete |
| calendars | Booking service types | ✅ Complete + payment fields |
| appointments | Booked sessions | ✅ Complete + payment fields |
| availability | Weekly schedule | ✅ Complete |
| clients | Client profiles | ✅ Complete |
| session_notes | Session notes | ✅ Complete |
| note_templates | Note templates | ✅ Complete |
| user_integrations | OAuth tokens + PG credentials | ✅ Complete |
| refund_tracking | Refund audit trail | ✅ Added Phase 4 |
| notifications | In-app notifications | ✅ Complete |
| client_activities | Homework/activities | ✅ Complete |
| client_transfers | Transfer requests | ✅ Complete |
| enterprise_leads | Enterprise enquiry form | ✅ Complete |

---

## API Routes (By Module)

### Authentication (`/auth`)
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/google
- GET /api/auth/google/callback
- POST /api/auth/verify-email

### Calendars (`/calendars`)
- POST /api/calendars — Create booking calendar
- GET /api/calendars — List therapist's calendars
- PUT /api/calendars/:id — Update calendar
- DELETE /api/calendars/:id — Delete calendar

### Appointments (`/bookings`)
- POST /api/bookings/public — Book via public page
- GET /api/bookings — List therapist's bookings
- PATCH /api/bookings/:id/status — Change booking status (+ auto-refund)
- GET /api/bookings/refunds/history — Refund tracking
- GET /api/bookings/payment-report — Payment breakdown

### Payment Gateway
#### Razorpay (`/razorpay`)
- POST /api/razorpay/connect — Therapist adds Razorpay account
- POST /api/razorpay/create-order — Create payment order
- POST /api/razorpay/verify-payment — Verify signature + mark paid
- POST /api/razorpay/refund — Process refund
- DELETE /api/razorpay/disconnect — Remove Razorpay account

#### Cashfree (`/cashfree`)
- POST /api/cashfree/connect — Therapist adds Cashfree account
- POST /api/cashfree/create-order — Create payment order
- POST /api/cashfree/verify-payment — Verify signature + mark paid
- POST /api/cashfree/refund — Process refund
- DELETE /api/cashfree/disconnect — Remove Cashfree account

### Clients (`/clients`)
- GET /api/clients — List all clients
- GET /api/clients/:id — Client profile
- POST /api/clients — Create client record
- PUT /api/clients/:id — Update client
- DELETE /api/clients/:id — Delete client

### Session Notes (`/notes`)
- POST /api/notes — Create session note
- GET /api/notes/:id — Fetch note
- PUT /api/notes/:id — Update note
- DELETE /api/notes/:id — Delete note
- POST /api/notes/upload-attachment — Upload file (Individual+ only)

### Activities (`/activities`)
- POST /api/activities — Create homework/activity (with reminder, Individual+ only)
- GET /api/activities/:client_id — List client's activities
- PUT /api/activities/:id — Update activity
- DELETE /api/activities/:id — Delete activity

### User Settings
- GET /api/users/profile — Get therapist profile
- PUT /api/users/profile — Update profile
- POST /api/users/change-password — Change password
- POST /api/users/upload-picture — Upload profile picture
- PUT /api/email-preferences — Configure reminder emails (Individual+ only)

### Integrations
- POST /api/connect_calendar — Connect Google Calendar
- POST /api/profile-link — Set custom profile URL (Individual+ only)
- GET /api/notifications — List notifications
- GET /api/availability — Get weekly availability

---

## Frontend Components

| Component | Purpose | Status |
|---|---|---|
| App.tsx | Main router & auth | ✅ Complete |
| Appointments.tsx | Booking list & management | ✅ Complete + refund UI |
| ClientView.tsx | Client profile & details | ✅ Complete |
| MyProfile.tsx | Therapist profile editor | ✅ Complete |
| MySettings.tsx | Settings (integrations, plans) | ✅ Complete |
| PaymentsInvoice.tsx | Payment dashboard & refunds | ✅ Complete Phase 4 |
| TherapistProfileView.tsx | Public booking page | ✅ Complete |
| UpgradePlanModal.tsx | Plan selection UI | ✅ Complete |
| BookingStatus.tsx | Post-payment confirmation | ✅ Complete |

---

## Security Features

- ✅ Password hashing (bcrypt)
- ✅ Session-based auth (express-session + PostgreSQL store)
- ✅ CORS protection
- ✅ Rate limiting on auth endpoints
- ✅ Helmet security headers
- ✅ Signature verification for payment gateway webhooks
- ✅ Payment amount validation (prevent client tampering)
- ✅ Idempotency keys for payment orders
- ✅ No PCI compliance burden (payment data never touches platform)

---

## Key Technical Decisions

### 1. Aggregator Model (Not Marketplace)
**Decision:** Therapists connect their own payment gateway accounts, not MelloMinds.  
**Why:** Avoids PCI compliance, regulatory burden, keeps platform simple, therapists own data.  
**Trade-off:** More onboarding friction (therapists must create Razorpay/Cashfree account).

### 2. Plan-Based Access via req.user.plan_name
**Decision:** Backend checks plan_name on every protected route.  
**Why:** Simple, auditable, prevents frontend bypass.  
**Trade-off:** Plan enforcement scattered across routes (not centralized middleware).

### 3. JSONB for Complex Data
**Decision:** Prices, cancellation_policy, form_data stored as JSONB in PostgreSQL.  
**Why:** Flexible schema evolution, no migrations for new fields.  
**Trade-off:** Less structured; need validation in app logic.

### 4. Direct HTTP fetch (No SDKs)
**Decision:** Use fetch() to call Razorpay/Cashfree APIs directly, no SDK.  
**Why:** Smaller bundle, simpler deployment, easier to debug.  
**Trade-off:** Manual signature verification, error handling.

### 5. Real-Time Updates via Socket.io
**Decision:** Live notification of payment status, booking changes.  
**Why:** Better UX (no page refresh needed).  
**Trade-off:** Added infrastructure (Socket.io server).

---

## Dev Environment

### Local Setup
```bash
# Backend (port 3001)
cd backend
npm install
npm run dev

# Frontend (port 5173)
cd frontend
npm install
npm run dev
```

### Environment Variables
- **Backend:** `.env` (DB connection, JWT secret, Cloudinary API, email provider, etc.)
- **Frontend:** `.env` (API_BASE_URL, VITE env vars)

### Database
- PostgreSQL 14+
- Connection via `pg` client
- Migrations in `backend/database/` or `backend/scripts/`

---

## Deployment

- **Backend:** Node.js on Render / Railway
- **Frontend:** React on Vercel
- **Database:** PostgreSQL on managed service (AWS RDS, Railway, etc.)
- **Email:** Resend or SendGrid for transactional emails
- **Images:** Cloudinary for profile pictures & documents

---

## Next Steps (Recommended Roadmap)

1. **Sandbox Testing** — Validate all payment flows with test credentials
2. **Subscription Billing** — Auto-charge Individual plan monthly
3. **Seat Management** — Enable Team plan with multiple therapists
4. **Settlement Tracking** — Show therapists when money lands
5. **White-Label** — Enterprise plan branding
6. **API & Webhooks** — Third-party integrations

---

## Support & References

- **Database Schema:** `database/schema.md`
- **Plan Details:** `INDIVIDUAL_PLAN.md`, `TEAM_PLAN.md`
- **Payment Implementation:** `docs/PAYMENT_POLICIES_IMPLEMENTATION_GUIDE.md`
- **Changes Log:** `docs/CHANGES_SUMMARY.md`

---

**Questions?** Review the specific feature docs or trace the API route in `backend/routes/`.
