# Integration Guide - MelloMinds Fixes

## Quick Start

This guide walks you through integrating all the fixes into your application.

---

## Step 1: Apply Database Migration (CRITICAL)

### Command:
```bash
cd backend
psql -U mello_admin -d mello_db -f ../database/fix_missing_schema.sql
```

### What it does:
- Creates 8 new tables (Clients, ClientTransfers, SessionNotes, etc.)
- Adds 6 new columns to Users table
- Adds 4 new columns to Appointments table
- Creates all necessary indexes and foreign keys

### Verify:
```bash
psql -U mello_admin -d mello_db -c "\dt"
```

You should see these new tables:
- Clients
- ClientTransfers
- SessionNotes
- ClientActivities
- Availability
- organization_therapists
- organization_details
- NoteTemplates

---

## Step 2: Merge Missing Endpoints into bookings.js

### File to Edit:
`backend/routes/bookings.js`

### Instructions:

1. **Open** `backend/routes/bookings_missing_endpoints.js`
2. **Copy** all the endpoint handlers (the 6 router.get/patch/post functions)
3. **Open** `backend/routes/bookings.js`
4. **Find** the line: `export default router;` (at the end of the file)
5. **Paste** all the endpoint handlers BEFORE that line

### Endpoints to Add:
```javascript
// 1. GET /api/bookings
router.get('/', ensureAuthenticated, async (req, res) => { ... });

// 2. PATCH /api/bookings/:id/status
router.patch('/:id/status', ensureAuthenticated, async (req, res) => { ... });

// 3. PATCH /api/bookings/:id/payment
router.patch('/:id/payment', ensureAuthenticated, async (req, res) => { ... });

// 4. POST /api/bookings/:id/reminder
router.post('/:id/reminder', ensureAuthenticated, async (req, res) => { ... });

// 5. PATCH /api/bookings/:id/reschedule
router.patch('/:id/reschedule', ensureAuthenticated, async (req, res) => { ... });

// 6. GET /api/bookings/stats
router.get('/stats', ensureAuthenticated, async (req, res) => { ... });
```

### Important Notes:
- The `ensureAuthenticated` middleware is already defined in bookings.js
- Don't duplicate the middleware definition
- Keep all existing endpoints intact
- Maintain the same error handling pattern

---

## Step 3: Verify Route Registration

### File to Check:
`backend/server.js`

### Look for:
```javascript
app.use('/api/bookings', apiLimiter, bookingsRoutes);
```

### If Missing:
Add this line in the routes section (around line 150-200):
```javascript
app.use('/api/bookings', apiLimiter, bookingsRoutes);
```

---

## Step 4: Test the Integration

### Test 1: Database Connection
```bash
cd backend
node -e "import pool from './config/database.js'; pool.query('SELECT COUNT(*) FROM Clients').then(r => console.log('✓ Clients table exists')).catch(e => console.error('✗ Error:', e.message))"
```

### Test 2: Start Backend Server
```bash
npm start
```

### Test 3: Test Endpoints with curl

#### Get all appointments:
```bash
curl -X GET http://localhost:5000/api/bookings \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```

#### Update appointment status:
```bash
curl -X PATCH http://localhost:5000/api/bookings/1/status \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID" \
  -d '{"status": "completed"}'
```

#### Get booking stats:
```bash
curl -X GET http://localhost:5000/api/bookings/stats \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```

---

## Step 5: Frontend Testing

The frontend components already call these endpoints:
- `Appointments.tsx` - Uses all 6 endpoints
- No frontend changes needed

### Test in Browser:
1. Navigate to Appointments page
2. Try to:
   - Load appointments (GET /api/bookings)
   - Update appointment status
   - Send reminder
   - Reschedule appointment
   - View statistics

---

## Troubleshooting

### Issue: "relation does not exist" error
**Solution**: Database migration not applied. Run Step 1 again.

### Issue: 404 on /api/bookings endpoint
**Solution**: Endpoints not merged into bookings.js. Complete Step 2.

### Issue: 401 Unauthorized
**Solution**: Not authenticated. Make sure you're logged in and have valid session.

### Issue: 403 Forbidden
**Solution**: Trying to access another therapist's appointments. Verify ownership check is working.

### Issue: Google Calendar not updating
**Solution**: Check if UserIntegrations table has valid access_token for the user.

### Issue: Email not sending
**Solution**: Check email configuration in backend/.env and verify isEmailEnabled() returns true.

---

## Rollback Plan

If you need to rollback:

### Rollback Database:
```bash
# This will drop all new tables (WARNING: Data loss!)
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

### Rollback Code:
1. Remove the 6 endpoint handlers from bookings.js
2. Restore from git: `git checkout backend/routes/bookings.js`

---

## Performance Considerations

### Indexes Created:
- `idx_clients_therapist_id` - Fast lookup by therapist
- `idx_client_transfers_from_therapist` - Fast lookup of outgoing transfers
- `idx_client_transfers_to_therapist` - Fast lookup of incoming transfers
- `idx_session_notes_therapist_id` - Fast lookup of notes
- `idx_appointments_therapist_id` - Fast lookup of appointments
- `idx_appointments_start_time` - Fast sorting by date
- `idx_appointments_status` - Fast filtering by status

### Query Optimization:
- All endpoints use indexed columns for WHERE clauses
- Pagination recommended for large result sets (add LIMIT/OFFSET)
- Consider caching for /api/bookings/stats

---

## Security Checklist

- [x] All endpoints require authentication
- [x] All endpoints verify therapist ownership
- [x] Input validation on all endpoints
- [x] SQL injection prevention (parameterized queries)
- [x] Rate limiting on public endpoints
- [x] Error messages don't leak sensitive info
- [x] Transaction rollback on errors
- [x] Proper error handling

---

## Next Steps

After integration:

1. **Test thoroughly** - Run all test cases
2. **Monitor logs** - Watch for errors in production
3. **Gather feedback** - Get user feedback on new features
4. **Optimize** - Add caching if needed
5. **Complete remaining features** - Client management, enterprise features, etc.

---

## Support

For issues or questions:
1. Check FIXES_APPLIED.md for detailed information
2. Review the endpoint implementations in bookings_missing_endpoints.js
3. Check backend logs for error messages
4. Verify database migration was applied correctly

---

**Last Updated**: May 27, 2026
**Status**: Ready for Integration
