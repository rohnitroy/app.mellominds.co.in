# Implementation Checklist - MelloMinds Fixes

## Pre-Implementation

- [ ] Read QUICK_FIX_REFERENCE.md
- [ ] Read INTEGRATION_GUIDE.md
- [ ] Backup database
- [ ] Backup code repository
- [ ] Create feature branch: `git checkout -b fix/critical-issues`

---

## Step 1: Database Migration

### Preparation
- [ ] Verify PostgreSQL is running
- [ ] Verify database credentials in backend/.env
- [ ] Verify database name is correct (mello_db)
- [ ] Verify user has permissions (mello_admin)

### Execution
- [ ] Run migration command:
  ```bash
  psql -U mello_admin -d mello_db -f database/fix_missing_schema.sql
  ```
- [ ] Check for errors in output
- [ ] Verify no "ERROR" messages

### Verification
- [ ] Verify all 8 tables created:
  ```bash
  psql -U mello_admin -d mello_db -c "\dt"
  ```
  - [ ] Clients
  - [ ] ClientTransfers
  - [ ] SessionNotes
  - [ ] ClientActivities
  - [ ] Availability
  - [ ] organization_therapists
  - [ ] organization_details
  - [ ] NoteTemplates

- [ ] Verify Users table has new columns:
  ```bash
  psql -U mello_admin -d mello_db -c "\d Users"
  ```
  - [ ] profile_slug
  - [ ] profile_slug_updated_at
  - [ ] org_role
  - [ ] org_owner_id
  - [ ] plan_name
  - [ ] reset_token
  - [ ] reset_token_expires

- [ ] Verify Appointments table has new columns:
  ```bash
  psql -U mello_admin -d mello_db -c "\d Appointments"
  ```
  - [ ] status
  - [ ] payment_status
  - [ ] payment_amount
  - [ ] cashfree_order_id
  - [ ] razorpay_order_id
  - [ ] razorpay_payment_id

- [ ] Verify indexes created:
  ```bash
  psql -U mello_admin -d mello_db -c "\di"
  ```
  - [ ] At least 15+ new indexes

---

## Step 2: Code Integration

### Preparation
- [ ] Open `backend/routes/bookings_missing_endpoints.js`
- [ ] Open `backend/routes/bookings.js`
- [ ] Identify the `export default router;` line in bookings.js

### Copy Endpoints
- [ ] Copy GET /api/bookings endpoint
- [ ] Copy PATCH /api/bookings/:id/status endpoint
- [ ] Copy PATCH /api/bookings/:id/payment endpoint
- [ ] Copy POST /api/bookings/:id/reminder endpoint
- [ ] Copy PATCH /api/bookings/:id/reschedule endpoint
- [ ] Copy GET /api/bookings/stats endpoint

### Paste into bookings.js
- [ ] Paste all 6 endpoints BEFORE `export default router;`
- [ ] Verify no duplicate code
- [ ] Verify no syntax errors
- [ ] Verify imports are present (should already be there)

### Verify Code Quality
- [ ] No duplicate middleware definitions
- [ ] All imports present
- [ ] Consistent error handling
- [ ] Consistent validation patterns
- [ ] Proper indentation

### Commit Changes
- [ ] Stage changes: `git add backend/routes/bookings.js`
- [ ] Commit: `git commit -m "feat: add missing booking endpoints"`

---

## Step 3: Backend Testing

### Start Backend
- [ ] Run: `npm start` in backend directory
- [ ] Verify no startup errors
- [ ] Verify server listening on port 5000
- [ ] Verify database connection successful

### Test Database Connection
- [ ] Run: `curl http://localhost:5000/auth/me`
- [ ] Should return 401 (not authenticated) or user data
- [ ] Should NOT return database error

### Test Endpoints (with valid session)

#### Test 1: GET /api/bookings
```bash
curl -X GET http://localhost:5000/api/bookings \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```
- [ ] Returns 200 OK
- [ ] Returns array of appointments
- [ ] No database errors

#### Test 2: PATCH /api/bookings/:id/status
```bash
curl -X PATCH http://localhost:5000/api/bookings/1/status \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{"status": "completed"}'
```
- [ ] Returns 200 OK or 404 (if appointment doesn't exist)
- [ ] No database errors
- [ ] Status updated in database

#### Test 3: PATCH /api/bookings/:id/payment
```bash
curl -X PATCH http://localhost:5000/api/bookings/1/payment \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{"payment_status": "paid", "payment_amount": 100}'
```
- [ ] Returns 200 OK or 404
- [ ] No database errors
- [ ] Payment status updated

#### Test 4: POST /api/bookings/:id/reminder
```bash
curl -X POST http://localhost:5000/api/bookings/1/reminder \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```
- [ ] Returns 200 OK or 404
- [ ] No database errors
- [ ] Email sent (check logs)

#### Test 5: PATCH /api/bookings/:id/reschedule
```bash
curl -X PATCH http://localhost:5000/api/bookings/1/reschedule \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{"new_start_time": "2026-06-01T10:00:00Z"}'
```
- [ ] Returns 200 OK or 404
- [ ] No database errors
- [ ] Appointment rescheduled

#### Test 6: GET /api/bookings/stats
```bash
curl -X GET http://localhost:5000/api/bookings/stats \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```
- [ ] Returns 200 OK
- [ ] Returns statistics object
- [ ] No database errors

### Test Error Handling
- [ ] Test without authentication (should return 401)
- [ ] Test with invalid appointment ID (should return 404)
- [ ] Test with invalid status (should return 400)
- [ ] Test with invalid payment status (should return 400)

---

## Step 4: Frontend Testing

### Start Frontend
- [ ] Run: `npm start` in frontend directory
- [ ] Verify no build errors
- [ ] Verify app loads in browser

### Test Appointments Page
- [ ] Navigate to Appointments page
- [ ] Verify appointments load (GET /api/bookings)
- [ ] Verify no console errors

### Test Update Status
- [ ] Click on appointment
- [ ] Change status to "completed"
- [ ] Verify status updates (PATCH /api/bookings/:id/status)
- [ ] Verify no errors

### Test Reschedule
- [ ] Click on appointment
- [ ] Click reschedule
- [ ] Select new time
- [ ] Verify reschedule works (PATCH /api/bookings/:id/reschedule)
- [ ] Verify no errors

### Test Send Reminder
- [ ] Click on appointment
- [ ] Click send reminder
- [ ] Verify reminder sent (POST /api/bookings/:id/reminder)
- [ ] Verify no errors

### Test Statistics
- [ ] Navigate to dashboard/analytics
- [ ] Verify statistics load (GET /api/bookings/stats)
- [ ] Verify correct numbers displayed

---

## Step 5: Integration Testing

### End-to-End Tests
- [ ] Create new appointment
- [ ] Update appointment status
- [ ] Reschedule appointment
- [ ] Send reminder
- [ ] View statistics
- [ ] All operations complete without errors

### Real-time Updates
- [ ] Open appointments in two browser tabs
- [ ] Update status in one tab
- [ ] Verify update appears in other tab (Socket.IO)
- [ ] Verify no errors

### Google Calendar Sync
- [ ] Connect Google Calendar
- [ ] Create appointment
- [ ] Verify event appears in Google Calendar
- [ ] Reschedule appointment
- [ ] Verify event updated in Google Calendar
- [ ] Verify no errors

### Email Notifications
- [ ] Send reminder
- [ ] Check email inbox
- [ ] Verify reminder email received
- [ ] Verify email content correct

---

## Step 6: Performance Testing

### Load Testing
- [ ] Test with 100 appointments
- [ ] Test with 1000 appointments
- [ ] Verify response times acceptable
- [ ] Verify no database timeouts

### Query Performance
- [ ] Check database query times
- [ ] Verify indexes being used
- [ ] Verify no full table scans
- [ ] Verify query plans optimal

---

## Step 7: Security Testing

### Authentication
- [ ] Test without session (should return 401)
- [ ] Test with invalid session (should return 401)
- [ ] Test with expired session (should return 401)

### Authorization
- [ ] Test accessing other user's appointments (should return 403)
- [ ] Test updating other user's appointments (should return 403)
- [ ] Test deleting other user's appointments (should return 403)

### Input Validation
- [ ] Test with invalid status (should return 400)
- [ ] Test with invalid payment status (should return 400)
- [ ] Test with invalid date (should return 400)
- [ ] Test with SQL injection (should be sanitized)

### Rate Limiting
- [ ] Test public endpoints with many requests
- [ ] Verify rate limiting works
- [ ] Verify 429 response when limit exceeded

---

## Step 8: Documentation

- [ ] Update README.md with new endpoints
- [ ] Update API documentation
- [ ] Update database schema documentation
- [ ] Add examples for new endpoints
- [ ] Document error codes and responses

---

## Step 9: Deployment Preparation

### Code Review
- [ ] Code reviewed by team member
- [ ] No security issues found
- [ ] No performance issues found
- [ ] No breaking changes

### Testing Summary
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All end-to-end tests passing
- [ ] No console errors
- [ ] No database errors

### Deployment Plan
- [ ] Deployment window scheduled
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Monitoring configured
- [ ] Alerts configured

---

## Step 10: Deployment

### Pre-Deployment
- [ ] Final backup of database
- [ ] Final backup of code
- [ ] Verify all tests passing
- [ ] Verify no uncommitted changes

### Deployment
- [ ] Merge feature branch to main
- [ ] Deploy to staging environment
- [ ] Run smoke tests on staging
- [ ] Deploy to production
- [ ] Run smoke tests on production

### Post-Deployment
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Monitor user feedback
- [ ] Verify all features working
- [ ] Verify no regressions

---

## Step 11: Post-Deployment

### Monitoring
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Monitor database performance
- [ ] Monitor user activity

### Feedback
- [ ] Gather user feedback
- [ ] Address any issues
- [ ] Document lessons learned
- [ ] Plan improvements

### Documentation
- [ ] Update deployment notes
- [ ] Update runbooks
- [ ] Update troubleshooting guide
- [ ] Archive old documentation

---

## Rollback Procedure (If Needed)

### Rollback Database
```bash
psql -U mello_admin -d mello_db -c "
DROP TABLE IF EXISTS NoteTemplates CASCADE;
DROP TABLE IF EXISTS organization_details CASCADE;
DROP TABLE IF EXISTS organization_therapists CASCADE;
DROP TABLE IF EXISTS ClientActivities CASCADE;
DROP TABLE IF EXISTS SessionNotes CASCADE;
DROP TABLE IF EXISTS ClientTransfers CASCADE;
DROP TABLE IF EXISTS Clients CASCADE;
DROP TABLE IF EXISTS Availability CASCADE;
"
```
- [ ] Verify tables dropped
- [ ] Verify no errors

### Rollback Code
```bash
git revert HEAD
git push origin main
```
- [ ] Verify code reverted
- [ ] Verify deployment successful

### Verify Rollback
- [ ] Verify old endpoints working
- [ ] Verify no new endpoints available
- [ ] Verify database back to original state
- [ ] Verify no errors

---

## Sign-Off

- [ ] All tests passing
- [ ] All documentation updated
- [ ] All team members notified
- [ ] Deployment successful
- [ ] No critical issues found

**Deployed By**: ___________________
**Date**: ___________________
**Time**: ___________________
**Status**: ✅ COMPLETE

---

**Notes**:
```
[Space for additional notes]
```

---

**Last Updated**: May 27, 2026
**Status**: Ready for Implementation
