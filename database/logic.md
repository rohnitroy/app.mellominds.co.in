# MelloMinds — Application Logic Reference

> Read-only documentation of all backend and frontend logic.
> Nothing here changes the app. Use this as a reference when switching DBs,
> onboarding new devs, or debugging flows.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Auth Flow](#auth-flow)
3. [Session & Security](#session--security)
4. [Booking Flow (Public)](#booking-flow-public)
5. [Availability & Slot Calculation](#availability--slot-calculation)
6. [Calendar Management](#calendar-management)
7. [Client Management](#client-management)
8. [Client Transfers](#client-transfers)
9. [Payments — Cashfree](#payments--cashfree)
10. [Refunds](#refunds)
11. [Session Notes](#session-notes)
12. [Activities & Reminders](#activities--reminders)
13. [Notifications](#notifications)
14. [Email System](#email-system)
15. [Google Calendar Integration](#google-calendar-integration)
16. [Dashboard Stats](#dashboard-stats)
17. [Enterprise Leads](#enterprise-leads)
18. [Plan / Upgrade Gating](#plan--upgrade-gating)
19. [API Route Map](#api-route-map)

---

## Tech Stack

- Backend: Node.js + Express (ESM), Passport.js, bcrypt, nodemailer
- Frontend: React + TypeScript, React Router
- Database: PostgreSQL (via `pg` Pool)
- File storage: Cloudinary (profile pictures)
- Payments: Cashfree PG (per-therapist credentials)
- Calendar sync: Google Calendar API (OAuth2)
- Auth: Session-based (express-session + Passport), Google OAuth2

---

## Auth Flow

### Email/Password Registration (`POST /auth/register`)
1. Validate fullName, email, password are present.
2. Check if email already exists in Users — return 409 if so.
3. Hash password with bcrypt (10 rounds).
4. Insert new user with `auth_provider = 'email'`.
5. Fire-and-forget: send new user alert email to admin team.
6. Return `{ user }` (no password in response).

### Email/Password Login (`POST /auth/login`)
1. Find user by email.
2. If user has no password (Google-only account) → return error "Please login with Google".
3. Compare password with bcrypt.
4. On success: call `req.login()` to create Passport session.
5. Return user object (password stripped).

### Google OAuth Login (`GET /auth/google`)
1. Redirect to Google with scopes: profile + email.
2. Google redirects back to `/auth/google/callback`.
3. Passport strategy:
   - Look up user by `google_id`.
   - If not found, check by email — if exists, link Google ID to existing account.
   - If neither, create new user with `auth_provider = 'google'`.
   - Fire-and-forget: send new user alert email to admin.
4. After login:
   - If user has no phone → redirect to `/complete-profile`.
   - Otherwise → redirect to `/`.

### Complete Profile (`POST /auth/complete-profile`)
- Requires active session.
- Updates phone, dob, gender, specialization, languages, address fields.

### Forgot Password (`POST /auth/forgot-password`)
1. Look up user by email (silently succeed even if not found — no email enumeration).
2. If Google account → return error.
3. Generate random 10-char temp password (alphanumeric, no ambiguous chars).
4. Hash and save to DB.
5. Email temp password to user. Never expose it in the API response.

### Logout (`POST /auth/logout`)
- Calls `req.logout()` then `req.session.destroy()`.

### Session Check (`GET /auth/me`)
- Returns current user if authenticated, 401 otherwise.

### Profile Picture Upload (`POST /auth/upload-profile-picture`)
- Accepts image file (max 5MB, jpeg/jpg/png/gif/webp).
- Uploads to Cloudinary under `mellominds/profile-pictures/`.
- Applies face-crop transformation (500x500).
- Saves Cloudinary URL to Users.profile_picture.
- Deletes old Cloudinary image if it existed.

---

## Session & Security

- Sessions stored server-side via `express-session`.
- Session cookie: `httpOnly`, `secure` in production, `sameSite: none` in production (cross-origin frontend).
- Cookie domain locked to `.mellominds.co.in` in production.
- Session max age: 24 hours.
- Rate limiting on `/auth/*`: 20 requests per 15 minutes per IP.
- Helmet used for security headers (CSP disabled — separate frontend origin).
- Request body size limit: 50KB.
- All therapist-facing API routes require `req.isAuthenticated()` middleware.

---

## Booking Flow (Public)

This is the core flow a client goes through on the public booking page.

### Step 1 — Load Calendar
- `GET /api/calendars/public/:userId/:slug`
- Returns calendar details + therapist name/photo.
- Only returns active calendars (`is_active = true`).

### Step 2 — Pick a Date & Slot
- `GET /api/availability/slots?date=YYYY-MM-DD&calendar_id=X`
- See [Availability & Slot Calculation](#availability--slot-calculation).

### Step 3a — No Payment
- Client fills form and clicks "Confirm Booking".
- `POST /api/bookings/public` with calendar_id, start_time, client details, form_responses.
- Server creates appointment, syncs to Google Calendar, sends confirmation emails.

### Step 3b — Cashfree Payment
- If `calendar.payment_enabled && calendar.payment_gateway === 'cashfree'`:
  1. `POST /api/cashfree/create-order` — creates a Cashfree order using therapist's stored credentials.
  2. Frontend loads Cashfree JS SDK dynamically.
  3. `cashfree.checkout({ paymentSessionId })` — redirects client to Cashfree payment page.
  4. After payment, Cashfree redirects to `/booking-status?order_id=...&...` (return_url).
  5. `BookingStatus.tsx` calls `POST /api/bookings/public` with `cashfree_order_id` included.
  6. Appointment is created with `payment_status = 'Pending'` initially.
  7. Cashfree webhook (`POST /api/cashfree/webhook`) fires and sets `payment_status = 'Paid'`.

### Idempotency
- If `cashfree_order_id` is provided and an appointment already exists for it, the existing appointment is returned immediately (prevents duplicate bookings on page refresh).

### Post-Booking Actions (all non-fatal)
- Upsert client into Clients table (so they appear in All Clients).
- For couples sessions: upsert partner as client too.
- Create in-app notification for therapist.
- Send confirmation email to client.
- Send notification email to therapist.
- Send confirmation to partner (couples).
- Send confirmation to any extra email fields in the intake form.

### Cancel/Reschedule (Token-based, no login required)
- Each appointment has a unique `cancel_token` (md5 hash).
- Emailed to client in the booking confirmation as a "Manage Booking" link.
- `GET /api/bookings/manage/:token` — fetch booking details.
- `POST /api/bookings/manage/:token/cancel` — cancel booking.
- `POST /api/bookings/manage/:token/reschedule` — reschedule booking.
- Link expires once `start_time` has passed (returns 410 Gone).

### Cancellation Policy Logic
- If `cancellation_policy.enabled` and `window` is set:
  - Check if `timeUntilSession < windowMs` → block cancellation.
- Refund type determines `payment_status` after cancel:
  - `full` → Refunded
  - `partial` → Partial Refund
  - `none` → stays Paid

### Reschedule Policy Logic
- If `reschedule_policy.enabled === false` → block rescheduling.
- If `window` is set → enforce minimum notice window.
- Updates Google Calendar event time if connected.

### Transfer Block
- If a client has been transferred away from a therapist (approved transfer), they cannot book through that therapist's page.

---

## Availability & Slot Calculation

`GET /api/availability/slots?date=YYYY-MM-DD&calendar_id=X`

1. Load calendar to get `duration` and `schedule_settings`.
2. Enforce date range from `schedule_settings.dateRangeType`:
   - `calendar_days` — max N days from today.
   - `business_days` — max N Mon–Fri days from today.
   - `range` — specific start/end date window.
   - `indefinitely` — no restriction.
3. Determine day of week in IST timezone.
4. Fetch therapist's `Availability` rows for that day (enabled only).
5. Fetch Google Calendar busy times via FreeBusy API (skipped gracefully if not connected).
6. Fetch internal Appointments for that date (non-cancelled).
7. Generate slots:
   - Walk through each availability window in 30-min minimum steps (or duration steps).
   - Skip slots that overlap with busy times (Google + internal), accounting for buffer.
   - Skip slots before `minNotice` cutoff (e.g. "no bookings within 2 hours").
   - Buffer types: `before_event` (pad before slot) or `after_event` (pad after slot).
8. Return array of formatted time strings in the client's requested timezone.

---

## Calendar Management

Therapists create "Calendars" which are booking service types (e.g. "50-min Individual Session").

- `GET /api/calendars` — list therapist's calendars.
- `POST /api/calendars` — create calendar with title, duration, slug, form_data, payment_data, locations, schedule_settings.
- `PUT /api/calendars/:id` — update any fields.
- `DELETE /api/calendars/:id` — delete calendar.
- Slug must be unique. Auto-generated from title + timestamp if not provided.
- `GET /api/calendars/payment-gateways` — returns available payment options (offline always included; connected PGs appended dynamically from UserIntegrations).

---

## Client Management

Clients are stored per-therapist in the `Clients` table.

### How clients get added
1. Automatically when a public booking is made (upsert by therapist_id + email).
2. Manually by therapist via `POST /api/clients`.

### Manual client creation
- Requires name + email.
- If `calendarId` provided, sends a booking link email to the client.
- Fires notification to therapist.

### Client CRUD
- `GET /api/clients/:id` — get single client.
- `PUT /api/clients/:id` — update client details.
- `DELETE /api/clients/:id` — only manually added clients can be deleted. Blocked if client has any pending/approved transfer.

### Client list (from bookings route)
- `GET /api/bookings/clients` — returns clients with aggregated stats (sessions, revenue, last session).
- Excludes clients that have been transferred out (approved transfer from this therapist).

---

## Client Transfers

Allows a therapist to transfer a client to another therapist.

### Initiate Transfer (`POST /api/clients/:id/transfer`)
1. Verify client belongs to requesting therapist.
2. Block if client has upcoming active bookings.
3. Look up target therapist by email.
4. Block if transferring to self.
5. Block if a pending transfer already exists for this client.
6. Create `ClientTransfers` record with status `pending`.
7. Create in-app notification for receiving therapist.
8. Send email to receiving therapist.

### Approve Transfer (`POST /api/clients/transfers/:transferId/approve`)
1. Verify receiving therapist is the one approving.
2. Upsert client into receiving therapist's Clients table.
3. If `transfer_options.notes` → reassign SessionNotes to new therapist.
4. If `transfer_options.activities` → reassign ClientActivities to new therapist.
5. Mark transfer as `approved`.
6. Notify sending therapist (in-app + email).
7. Notify receiving therapist of success.

### Reject Transfer (`POST /api/clients/transfers/:transferId/reject`)
- Mark as `rejected`.
- Notify sending therapist (in-app + email).

### Cancel Transfer (`DELETE /api/clients/transfers/:transferId/cancel`)
- Only sending therapist can cancel a pending transfer.
- Deletes the transfer record.
- Notifies receiving therapist (in-app + email).
- Notifies client (email).

---

## Payments — Cashfree

### Connect (`POST /api/cashfree/connect`)
1. Validate `app_id` and `secret_key` are provided.
2. Test credentials by calling Cashfree API (`GET /orders?count=1`).
3. If valid, upsert into `UserIntegrations` with `provider = 'cashfree'`.

### Status (`GET /api/cashfree/status`)
- Returns `{ connected: bool, environment }` from UserIntegrations.

### Disconnect (`DELETE /api/cashfree/disconnect`)
- Deletes the cashfree row from UserIntegrations.

### Create Order (`POST /api/cashfree/create-order`) — Public
1. Fetch calendar + therapist ID.
2. Verify `payment_enabled = true`.
3. Fetch therapist's Cashfree credentials from UserIntegrations.
4. Build order payload with `order_id = mello_<calendarId>_<timestamp>`.
5. Set `return_url` to `/booking-status` with all booking params in query string.
6. Set `notify_url` to `/api/cashfree/webhook`.
7. Call Cashfree API to create order.
8. Return `{ order_id, payment_session_id, environment }` to frontend.

### Webhook (`POST /api/cashfree/webhook`)
1. Parse raw body (required for signature verification).
2. Only process `PAYMENT_SUCCESS_WEBHOOK` events.
3. If signature headers present: verify HMAC-SHA256 signature using therapist's secret key.
4. In production: reject if no signature headers.
5. On valid payment: `UPDATE Appointments SET payment_status = 'Paid' WHERE cashfree_order_id = orderId`.

---

## Refunds

`POST /api/cashfree/refund` (therapist-authenticated)

1. Fetch appointment, verify it belongs to requesting therapist.
2. Verify `cashfree_order_id` exists (Cashfree booking).
3. Verify `payment_status = 'Paid'`.
4. Fetch therapist's Cashfree credentials.
5. Call Cashfree refund API: `POST /orders/:orderId/refunds`.
6. Update `payment_status`:
   - Full refund → `Refunded`
   - Partial refund → `Partial Refund`

### Manual payment status update (non-Cashfree bookings)
- `PATCH /api/bookings/:id/payment` — therapist can manually set payment_status for offline/cash bookings.

---

## Session Notes

### Note Template
- Each therapist has one custom template stored in `NoteTemplates`.
- Default template has 3 fields: Session Summary, Client Mood, Homework.
- `GET /api/notes/template/me` — fetch template (returns default if none saved).
- `POST /api/notes/template/me` — save/update template.

### Notes CRUD
- `POST /api/notes` — create note for an appointment (verifies appointment ownership).
- `GET /api/notes/:appointmentId` — get all notes for an appointment.
- `PUT /api/notes/:id` — edit note.
- `DELETE /api/notes/:id` — delete note.
- Notes are stored as JSONB (`note_content`) matching the template structure.

---

## Activities & Reminders

Therapists can assign activities/homework to clients.

### Create Activity (`POST /api/activities`)
1. Store activity in `ClientActivities`.
2. If `notify_client = true`:
   - Set `reminder_count`, `reminder_interval_days`.
   - Calculate `next_reminder_at = now + interval_days`.
   - Send immediate notification email to client (fire-and-forget).

### Reminder Cron (runs every hour on server startup)
- Queries `ClientActivities` where `notify_client = true` AND `reminders_sent < reminder_count` AND `next_reminder_at <= NOW()`.
- For each due activity:
  1. Send reminder email to client.
  2. Increment `reminders_sent`.
  3. Calculate next `next_reminder_at` (or set to NULL if all reminders sent).

### Delete Activity (`DELETE /api/activities/:id`)
- Therapist can delete any of their activities.

---

## Notifications

In-app notification system for therapists.

### Types
| Type | Trigger |
|---|---|
| new_booking | Public booking created |
| cancellation | Client cancels via token link |
| reschedule | Client reschedules via token link |
| new_client | Therapist manually adds a client |
| transfer_request | Therapist B receives a transfer request |
| transfer_approved | Therapist A's transfer was approved |
| transfer_rejected | Therapist A's transfer was rejected |
| transfer_cancelled | Receiving therapist notified of cancellation |
| transfer_success | Receiving therapist notified transfer complete |

### API
- `GET /api/notifications` — last 50 notifications for current user.
- `GET /api/notifications/unread-count` — count of unread.
- `PUT /api/notifications/read-all` — mark all as read.
- `PUT /api/notifications/:id/read` — mark single as read.

---

## Email System

All emails sent via Gmail SMTP using nodemailer (`GMAIL_USER` + `GMAIL_APP_PASSWORD`).
Emails are non-fatal — failures are logged but never crash a request.

### Email Templates

| Template | Trigger |
|---|---|
| `bookingConfirmationEmail` | New booking confirmed (client + therapist) |
| `cancellationEmail` | Booking cancelled (client + therapist) |
| `rescheduleConfirmationEmail` | Booking rescheduled (client + therapist) |
| `bookingLinkEmail` | Therapist sends booking link to client |
| `forgotPasswordEmail` | Password reset — sends temp password |
| `transferRequestEmail` | Transfer request to receiving therapist |
| `transferApprovedEmail` | Transfer approved — sent to sending therapist |
| `transferRejectedEmail` | Transfer rejected — sent to sending therapist |
| `transferCancelledEmail` | Transfer cancelled — sent to receiving therapist + client |
| `activityNotificationEmail` | New activity or reminder sent to client |
| `enterpriseLeadEmail` | Enterprise enquiry — sent to admin team |
| `newUserAlertEmail` | New therapist signup — sent to admin team |

### Booking confirmation email includes
- Session title, date/time (IST), location type.
- Google Meet link (if available).
- "Cancel or Reschedule" button (links to `/manage-booking/:cancel_token`).

---

## Google Calendar Integration

### Connect (`GET /api/connect-calendar/start`)
- Generates Google OAuth URL with scopes: calendar + calendar.events + profile + email.
- Uses `access_type: offline` and `prompt: consent` to ensure refresh token is returned.
- Redirects user to Google.

### Callback (`GET /api/connect-calendar/callback`)
- Exchanges auth code for tokens.
- Upserts tokens into `UserIntegrations` with `provider = 'google'`.
- Redirects to `/dashboard?calendar_connected=true`.

### Token Refresh (`lib/googleAuth.js`)
- Called before every Google API operation.
- If token is expired or within 5 minutes of expiry → refresh using refresh_token.
- Persists new tokens to DB.
- If refresh fails with `invalid_grant` (user revoked access) → deletes stale record, returns null.
- Callers degrade gracefully when null is returned (booking still works, just no Google event).

### Usage in Bookings
- On new booking: creates Google Calendar event with Meet link.
- On cancellation: deletes Google Calendar event.
- On reschedule: patches Google Calendar event with new times.

### Disconnect (`DELETE /api/connect-calendar/disconnect`)
- Deletes the google row from UserIntegrations.

---

## Dashboard Stats

`GET /api/bookings/stats?startDate=...&endDate=...`

Returns for the authenticated therapist (optionally filtered by date range):
- `revenue` — sum of payment_amount where payment_status IN (Paid, Partial Refund) and not cancelled.
- `refund` — sum of payment_amount where payment_status = Refunded.
- `sessions` — total appointment count.
- `cancelled` — count of cancelled appointments.
- `noShow` — count of noshow appointments.
- `pendingNotes` — completed appointments with no SessionNote.
- `pendingPayment` — non-cancelled appointments with payment_status = Pending.
- `noOfClients` — total clients in Clients table (not date-filtered).

---

## Enterprise Leads

`POST /api/enterprise/leads`

1. Validate name, phone, email, company_name are present.
2. Validate email format.
3. Insert into `enterprise_leads` table.
4. Send notification email to admin team (fire-and-forget).

---

## Plan / Upgrade Gating

Plan gating is handled on the frontend via `UpgradePlanModal.tsx`.

### Free Tier includes
- Payments & invoice dashboard
- Basic features

### Pro Tier adds
- Custom profile link (own URL slug)
- Payment gateway integration (Cashfree / Razorpay)
- Online payments on booking page
- Automated refund management
- Manage reminder schedules
- WhatsApp reminders

The backend does not currently enforce plan checks on API routes — gating is UI-level only.

---

## API Route Map

### Auth (`/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | No | Register new therapist |
| POST | /auth/login | No | Email/password login |
| GET | /auth/google | No | Initiate Google OAuth |
| GET | /auth/google/callback | No | Google OAuth callback |
| POST | /auth/complete-profile | Yes | Complete profile after Google signup |
| POST | /auth/forgot-password | No | Send temp password |
| POST | /auth/logout | Yes | Logout |
| GET | /auth/me | No | Get current user |
| POST | /auth/upload-profile-picture | Yes | Upload profile picture |

### Calendars (`/api/calendars`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/calendars/public/:userId/:slug | No | Get public calendar |
| GET | /api/calendars/payment-gateways | Optional | Get available payment gateways |
| GET | /api/calendars | Yes | List therapist's calendars |
| POST | /api/calendars | Yes | Create calendar |
| PUT | /api/calendars/:id | Yes | Update calendar |
| DELETE | /api/calendars/:id | Yes | Delete calendar |

### Bookings (`/api/bookings`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/bookings/public | No | Create public booking |
| GET | /api/bookings/manage/:token | No | Get booking by cancel token |
| POST | /api/bookings/manage/:token/cancel | No | Client cancels booking |
| POST | /api/bookings/manage/:token/reschedule | No | Client reschedules booking |
| GET | /api/bookings/stats | Yes | Dashboard stats |
| GET | /api/bookings/clients | Yes | List clients with stats |
| GET | /api/bookings | Yes | List therapist's appointments |
| PUT | /api/bookings/:id | Yes | Update appointment |
| DELETE | /api/bookings/:id | Yes | Delete appointment |
| PATCH | /api/bookings/:id/payment | Yes | Update payment status manually |

### Availability (`/api/availability`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/availability/slots | No | Get available slots for a date |
| GET | /api/availability | Yes | Get therapist's weekly schedule |
| POST | /api/availability | Yes | Save weekly schedule |

### Clients (`/api/clients`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/clients/lookup-therapist | Yes | Look up therapist by email |
| GET | /api/clients/transfers/outgoing | Yes | List outgoing transfers |
| POST | /api/clients/transfers/:id/approve | Yes | Approve transfer |
| POST | /api/clients/transfers/:id/reject | Yes | Reject transfer |
| DELETE | /api/clients/transfers/:id/cancel | Yes | Cancel pending transfer |
| POST | /api/clients | Yes | Create client manually |
| GET | /api/clients/:id | Yes | Get client |
| PUT | /api/clients/:id | Yes | Update client |
| DELETE | /api/clients/:id | Yes | Delete client |
| GET | /api/clients/:id/transfer-info | Yes | Get transfer info for client |
| POST | /api/clients/:id/transfer | Yes | Initiate transfer |

### Notes (`/api/notes`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/notes/template/me | Yes | Get note template |
| POST | /api/notes/template/me | Yes | Save note template |
| POST | /api/notes | Yes | Create note |
| GET | /api/notes/:appointmentId | Yes | Get notes for appointment |
| PUT | /api/notes/:id | Yes | Edit note |
| DELETE | /api/notes/:id | Yes | Delete note |

### Notifications (`/api/notifications`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/notifications | Yes | Get all notifications |
| GET | /api/notifications/unread-count | Yes | Get unread count |
| PUT | /api/notifications/read-all | Yes | Mark all as read |
| PUT | /api/notifications/:id/read | Yes | Mark one as read |

### Activities (`/api/activities`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/activities/:clientId | Yes | Get activities for client |
| POST | /api/activities | Yes | Create activity |
| DELETE | /api/activities/:id | Yes | Delete activity |

### Cashfree (`/api/cashfree`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/cashfree/connect | Yes | Save Cashfree credentials |
| GET | /api/cashfree/status | Yes | Check connection status |
| DELETE | /api/cashfree/disconnect | Yes | Remove Cashfree credentials |
| POST | /api/cashfree/create-order | No | Create payment order (public) |
| POST | /api/cashfree/refund | Yes | Initiate refund |
| POST | /api/cashfree/webhook | No | Cashfree payment webhook |

### Google Calendar (`/api/connect-calendar`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/connect-calendar/start | Yes | Start Google Calendar OAuth |
| GET | /api/connect-calendar/callback | Yes | OAuth callback |
| GET | /api/connect-calendar/status | Yes | Check connection status |
| DELETE | /api/connect-calendar/disconnect | Yes | Disconnect Google Calendar |

### Enterprise (`/api/enterprise`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/enterprise/leads | No | Submit enterprise enquiry |
