# Team Plan Implementation

**Status:** Partially Implemented  
**Created:** 2026-06-04  
**Version:** 1.0

## Overview

Team Plan is enterprise subscription for organizations at **₹1,499/seat/month** for multi-therapist teams.

## Features

### Included in Team Plan

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

#### Pro Features (Team Only)
- ✅ Custom profile link (your own URL)
- ✅ Payment gateway integration (Cashfree / Razorpay)
- ✅ Online payments on booking page
- ✅ Automated refund management
- ✅ Manage & configure reminder schedules
- ✅ WhatsApp reminders to clients
- ✅ Unlimited calendars & bookings
- ✅ Advanced analytics & reporting
- ✅ Add team members (up to 20 seats)
- ✅ Dedicated account manager
- ✅ Priority support

#### Explicitly Excluded (Was Listed, Now Removed)
- ❌ Custom domain & white-label branding
- ❌ API access & webhook integrations

## Implementation Details

### Database
- **plan_name:** 'team'
- **Tables:**
  - `organization_details` — org branding, settings
  - `organization_therapists` — team members, roles
  - `users.org_role` — owner/member
  - `users.org_owner_id` — organization owner reference
  - `users.purchased_seats` — seat count

### Backend Restrictions by Feature

#### Organization Management
**Routes:**
- `GET /auth/dashboard-prefs` — Dashboard customization
- `PUT /auth/dashboard-prefs` — Save dashboard preferences
- `GET /auth/organization-analytics` — Organization analytics
- `PUT /auth/organization-details` — Update org info

**Access:** Team owner only (not members)

#### Team Member Management
**Routes:**
- `GET /api/users` — List team members
- `POST /api/users/invite` — Invite new member
- `DELETE /api/users/:id` — Remove member
- `PUT /api/users/:id` — Update member role

**Access:** Team owner only

#### Advanced Features Requiring Team Plan
**Routes:**
- `POST /api/notes/upload-attachment` — File attachments
- `PUT /api/profile-link` — Custom profile links
- `GET /api/gmail/start` — Gmail integration (read-only)
- `POST /api/clients/transfers/:id/owner-approve` — Client transfers

**Access:** Team members allowed

### Status: ✅ Implemented
- Dashboard customization (preferences saved)
- Organization details management
- Organization analytics (owner only)
- Team member invite/remove
- Custom profile links
- File attachments in notes
- Gmail integration (read)
- Client transfer approvals (owner only)
- Reminder scheduling (same as Individual)
- Payment gateway (same as Individual)

### Status: ❌ NOT Implemented (and removed from plan)
- Custom domain support
- CSS/theme customization
- API endpoint infrastructure
- Webhook system
- API key management UI

### Status: ⚠️ INCOMPLETE (Still on plan but broken)
- Seat management — `purchased_seats` exists but:
  - No UI to purchase additional seats
  - No invoice generation for seat purchases
  - No auto-limit enforcement
  - No refund logic for downgrades
- Monthly billing — No recurring subscription:
  - No auto-charge for seats
  - No invoice generation
  - Manual sales-based upgrade only
- WhatsApp reminders — Listed but not implemented

## Changes Made

### Frontend
- ✅ `frontend/src/components/UpgradePlanModal.tsx` — Removed White-label & API features

### Documentation
- ✅ Created `TEAM_PLAN.md`

## Testing Checklist

### Team Owner Access
- [ ] Dashboard customization works
- [ ] Organization details accessible
- [ ] Organization analytics visible
- [ ] Can invite team members
- [ ] Can remove team members
- [ ] Can approve client transfers

### Team Member Access
- [ ] Cannot access organization settings
- [ ] Can use custom profile link
- [ ] Can upload file attachments
- [ ] Can access payment gateway
- [ ] Can configure reminders

### Non-Team Users
- [ ] Cannot access team features
- [ ] Receive 403 Forbidden on team endpoints

## Known Issues

1. **No seat purchase mechanism** — users can't buy additional seats
2. **No recurring billing** — Free manual upgrade only
3. **WhatsApp reminders** — Feature listed but not implemented
4. **Unlimited calendars** — Feature listed but not enforced in code
5. **Advanced analytics** — Basic dashboard exists, advanced features missing

## Related Files

- `frontend/src/components/UpgradePlanModal.tsx`
- `backend/routes/auth.js` — Organization management
- `backend/routes/users.js` — Team member management
- `backend/routes/bookings.js` — Team logic
- `backend/routes/notes.js` — File attachments
- `backend/routes/profileLink.js` — Custom profile
- `backend/routes/activities.js` — Reminders
- `backend/routes/emailPreferences.js` — Email settings
- `backend/routes/razorpay.js` — Payment gateway
- `backend/routes/cashfree.js` — Payment gateway

## Notes

- Team plan is a commercial offering requiring manual approval
- Pricing: ₹1,499 per seat per month
- Seat limit: up to 20 members per organization
- No automated seat purchase or billing — all manual
- Two features removed due to lack of implementation
