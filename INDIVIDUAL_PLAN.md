# Individual Plan Implementation

**Status:** In Progress  
**Created:** 2026-06-04  
**Version:** 1.0

## Overview

Individual Plan is a mid-tier subscription between Free (₹0) and Team (₹1,499/seat/month) at **₹699/month** for solo practitioners.

## Features

### Included in Individual Plan

#### From Free Tier (All Features)
- Booking calendars (one-on-one, group, couples)
- Public booking page with shareable link
- Custom intake form questions
- Google Calendar & Google Meet integration
- Weekly availability scheduling
- Client database & session history
- Session notes & customizable templates
- Client activity & homework tracking
- Client transfer system
- Dashboard analytics & stats
- In-app & email notifications
- Offline payments (Cash / UPI)
- Payments & invoice dashboard

#### Pro Features (Individual Only)
- ✅ Custom profile link (your own URL)
- ✅ Payment gateway integration (Cashfree / Razorpay)
- ✅ Online payments on booking page
- ✅ Automated refund management
- ✅ Manage & configure reminder schedules
- ✅ Dedicated account manager
- ✅ Priority support

#### Explicitly Excluded
- ❌ WhatsApp reminders to clients
- ❌ Custom domain & white-label branding (Team only)
- ❌ Unlimited calendars & bookings (Team only)
- ❌ Advanced analytics & reporting (Team only)
- ❌ Add team members (Team only)
- ❌ API access & webhook integrations (Team only)

## Implementation Details

### Database
- **Column:** `users.plan_name`
- **Type:** VARCHAR(50)
- **Valid Values:** 'free', 'individual', 'team', 'enterprise'
- **Default:** 'free'

### Backend Restrictions by Plan

#### Payment Gateway Access
**Routes:** `POST /api/razorpay/connect` & `POST /api/cashfree/connect`

- **Free:** ❌ Blocked — 403 Forbidden
- **Individual:** ✅ Allowed
- **Team:** ✅ Allowed
- **Enterprise:** ✅ Allowed

**Status:** ✅ Implemented
- `backend/routes/razorpay.js` — Added plan check
- `backend/routes/cashfree.js` — Added plan check

#### Reminder Schedule Management
**Routes:** 
- `POST /api/activities` — Create activity with reminders
- `PUT /api/email-preferences` — Configure reminder emails

- **Free:** ❌ Blocked — 403 Forbidden
- **Individual:** ✅ Allowed
- **Team:** ✅ Allowed
- **Enterprise:** ✅ Allowed

**Status:** ✅ Implemented
- `backend/routes/activities.js` — Added plan check for reminder creation
- `backend/routes/emailPreferences.js` — Added plan check for reminder configuration

#### Custom Profile Link
**Route:** `PUT /api/profile-link`

- **Free:** ❌ Blocked
- **Individual:** ✅ Allowed
- **Team:** ✅ Allowed
- **Enterprise:** ✅ Allowed

**Status:** ✅ Already implemented in `backend/routes/profileLink.js`

#### Session Note Attachments
**Route:** `POST /api/notes/upload-attachment`

- **Free:** ❌ Blocked
- **Individual:** ✅ Allowed
- **Team:** ✅ Allowed
- **Enterprise:** ✅ Allowed

**Status:** ✅ Already implemented in `backend/routes/notes.js`

## Changes Made

### Frontend
- ✅ `frontend/src/components/UpgradePlanModal.tsx` — Added Individual plan UI
- ✅ Removed WhatsApp reminders from Individual feature list

### Backend
- ✅ `backend/routes/profileLink.js` — Allow Individual plan for custom profile links
- ✅ `backend/routes/notes.js` — Allow Individual plan for file uploads
- ✅ `backend/scripts/migrate_plan_column.js` — Updated plan constraint

### Database
- ✅ Verified plan_name column accepts 'individual'
- ✅ All required tables present (users, calendars, appointments, etc.)

## TODO

### Completed ✅
- [x] Payment gateway limits by plan
- [x] Reminder schedule management restrictions by plan
- [x] Removed WhatsApp reminders from Individual plan

### Future (Not In Scope)
- [ ] Upgrade endpoint (`POST /api/users/upgrade-plan`)
- [ ] Payment processing (Razorpay/Cashfree recurring)
- [ ] Subscription billing & invoicing
- [ ] Billing dashboard UI
- [ ] Payment webhooks
- [ ] WhatsApp reminders implementation
- [ ] Seat management for Team plan

## Testing Checklist

### Database
- [x] plan_name column created
- [x] 'individual' value insertable
- [x] Schema migration runs without errors

### Frontend
- [ ] Individual plan displays in upgrade modal
- [ ] WhatsApp reminder removed from Individual features
- [ ] Team plan unaffected

### Backend
- [ ] Payment gateway blocked for Free tier users
- [ ] Payment gateway allowed for Individual tier users
- [ ] Reminder schedule blocked for Free tier users
- [ ] Reminder schedule allowed for Individual tier users

## Notes

- WhatsApp reminders feature is intentionally excluded from Individual plan for this phase
- No subscription billing logic implemented yet (manual admin assignment only)
- All payment data stored in `appointments` table (no separate payments table)
- Individual plan pricing: ₹699/month (subject to change based on market feedback)

## Related Files

- `frontend/src/components/UpgradePlanModal.tsx`
- `backend/routes/profileLink.js`
- `backend/routes/notes.js`
- `backend/routes/razorpay.js`
- `backend/routes/cashfree.js`
- `backend/routes/emailPreferences.js`
- `backend/scripts/migrate_plan_column.js`
