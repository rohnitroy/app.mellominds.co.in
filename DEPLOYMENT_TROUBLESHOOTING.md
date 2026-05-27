# Deployment Troubleshooting Guide

## Common Issues & Solutions

---

## 1. Schema Tampering Detected

### Error:
```
🚨 SCHEMA TAMPERING DETECTED - Schema has been modified!
Stored hash: 2c50c0d47d11b40cfccd79b68dc493d633cd28914bca5724c8e269e2f1c9815d
Current hash: 6ff1a5cac5a4a6a70a321b0d4c325546a69e145d8dd3bd01bf4f86dc0ad4a6e7
🚨 CRITICAL: Schema tampering detected. Application cannot start.
```

### Cause:
Database schema has changed (new tables/columns added)

### Solution:

**Step 1: Verify Schema Changes**
```bash
psql -U mello_admin -d mello_db -c "\dt"
```

**Step 2: Regenerate Schema Hash**
```bash
node backend/regenerate-schema-hash.js
```

**Step 3: Restart Application**
```bash
npm start
```

**Step 4: Verify**
```bash
curl http://localhost:5000/auth/me
```

---

## 2. Relation Does Not Exist

### Error:
```
ERROR: relation "clients" does not exist
ERROR: relation "ClientTransfers" does not exist
```

### Cause:
Database migration not applied

### Solution:

**Step 1: Check if Tables Exist**
```bash
psql -U mello_admin -d mello_db -c "\dt"
```

**Step 2: Apply Migration**
```bash
psql -U mello_admin -d mello_db -f database/fix_missing_schema.sql
```

**Step 3: Verify Tables Created**
```bash
psql -U mello_admin -d mello_db -c "\dt"
```

**Step 4: Regenerate Schema Hash**
```bash
node backend/regenerate-schema-hash.js
```

**Step 5: Restart Application**
```bash
npm start
```

---

## 3. Column Does Not Exist

### Error:
```
ERROR: column "plan_name" does not exist
ERROR: column "org_role" does not exist
```

### Cause:
New columns not added to Users table

### Solution:

**Step 1: Check Columns**
```bash
psql -U mello_admin -d mello_db -c "\d users"
```

**Step 2: Apply Migration**
```bash
psql -U mello_admin -d mello_db -f database/fix_missing_schema.sql
```

**Step 3: Verify Columns Added**
```bash
psql -U mello_admin -d mello_db -c "\d users"
```

**Step 4: Regenerate Schema Hash**
```bash
node backend/regenerate-schema-hash.js
```

---

## 4. Database Connection Failed

### Error:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: password authentication failed
```

### Cause:
Database not running or credentials incorrect

### Solution:

**Step 1: Verify Database is Running**
```bash
psql -U mello_admin -d mello_db -c "SELECT 1"
```

**Step 2: Check Connection String**
```bash
echo $DATABASE_URL
```

**Step 3: Verify Credentials**
```bash
psql -U mello_admin -d mello_db -c "SELECT current_user"
```

**Step 4: Check Environment Variables**
```bash
# In Render Dashboard:
# Settings → Environment → Check DATABASE_URL
```

**Step 5: Restart Database Connection**
```bash
npm start
```

---

## 5. Port Already in Use

### Error:
```
Error: listen EADDRINUSE :::5000
```

### Cause:
Another process using port 5000

### Solution:

**Option 1: Kill Process**
```bash
lsof -i :5000
kill -9 <PID>
npm start
```

**Option 2: Use Different Port**
```bash
PORT=5001 npm start
```

**Option 3: Check What's Using Port**
```bash
netstat -tulpn | grep 5000
```

---

## 6. Environment Variables Not Loaded

### Error:
```
Error: DATABASE_URL is not defined
Error: SESSION_SECRET is not defined
```

### Cause:
Environment variables not set in Render

### Solution:

**Step 1: Check Environment Variables**
```bash
# In Render Dashboard:
# Settings → Environment
```

**Step 2: Add Missing Variables**
```
DATABASE_URL=postgresql://mello_admin:PASSWORD@HOST:5432/mello_db
SESSION_SECRET=your-secret-key
FRONTEND_URL=https://your-frontend-url.com
```

**Step 3: Redeploy**
```bash
# In Render Dashboard:
# Click "Manual Deploy"
```

---

## 7. Endpoints Returning 404

### Error:
```
404 Not Found
GET /api/bookings
```

### Cause:
Endpoints not merged into bookings.js

### Solution:

**Step 1: Verify Endpoints Exist**
```bash
grep -n "router.get.*bookings" backend/routes/bookings.js
```

**Step 2: Merge Endpoints**
- Copy from `backend/routes/bookings_missing_endpoints.js`
- Paste into `backend/routes/bookings.js`

**Step 3: Verify Syntax**
```bash
node -c backend/routes/bookings.js
```

**Step 4: Restart Application**
```bash
npm start
```

---

## 8. Authentication Failing

### Error:
```
401 Unauthorized
Error: Not authenticated
```

### Cause:
Session not valid or authentication middleware issue

### Solution:

**Step 1: Check Session**
```bash
curl -X GET http://localhost:5000/auth/me \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```

**Step 2: Login First**
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

**Step 3: Check Session Secret**
```bash
echo $SESSION_SECRET
```

**Step 4: Verify Middleware**
```bash
grep -n "ensureAuthenticated" backend/routes/bookings.js
```

---

## 9. Email Not Sending

### Error:
```
Error: Failed to send email
Error: Resend API key invalid
```

### Cause:
Email configuration not set or API key invalid

### Solution:

**Step 1: Check Resend API Key**
```bash
echo $RESEND_API_KEY
```

**Step 2: Verify Email Configuration**
```bash
# In backend/.env
RESEND_API_KEY=your-key-here
```

**Step 3: Test Email**
```bash
curl -X POST http://localhost:5000/api/bookings/1/reminder \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```

**Step 4: Check Logs**
```bash
# Look for email sending errors
npm start
```

---

## 10. Real-time Updates Not Working

### Error:
```
Socket.IO connection failed
Real-time updates not received
```

### Cause:
Socket.IO not configured or connection issue

### Solution:

**Step 1: Check Socket.IO**
```bash
grep -n "getIO\|socket.io" backend/server.js
```

**Step 2: Verify Socket.IO Middleware**
```bash
grep -n "io.emit" backend/routes/bookings.js
```

**Step 3: Check Frontend Connection**
```javascript
// In browser console
console.log(socket.connected)
```

**Step 4: Restart Application**
```bash
npm start
```

---

## 11. Google Calendar Sync Not Working

### Error:
```
Error: Google Calendar event not updated
Error: Invalid access token
```

### Cause:
Google OAuth token expired or not configured

### Solution:

**Step 1: Check Integration**
```bash
psql -U mello_admin -d mello_db -c "SELECT * FROM UserIntegrations WHERE provider='google';"
```

**Step 2: Verify Token**
```bash
# Check if access_token exists and is valid
```

**Step 3: Refresh Token**
```bash
# User needs to reconnect Google Calendar
```

**Step 4: Check Logs**
```bash
# Look for Google Calendar errors
npm start
```

---

## 12. Memory/CPU Issues

### Error:
```
Error: JavaScript heap out of memory
Error: Process killed due to high CPU
```

### Cause:
Memory leak or inefficient queries

### Solution:

**Step 1: Check Memory Usage**
```bash
# In Render Dashboard:
# Metrics → Memory
```

**Step 2: Check CPU Usage**
```bash
# In Render Dashboard:
# Metrics → CPU
```

**Step 3: Optimize Queries**
```bash
# Check slow queries
psql -U mello_admin -d mello_db -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

**Step 4: Add Indexes**
```bash
# Verify indexes exist
psql -U mello_admin -d mello_db -c "\di"
```

**Step 5: Increase Resources**
```bash
# In Render Dashboard:
# Settings → Plan → Upgrade
```

---

## 13. Deployment Stuck

### Error:
```
Deployment in progress...
Build taking too long
```

### Cause:
Build process stuck or dependencies taking too long

### Solution:

**Step 1: Cancel Deployment**
```bash
# In Render Dashboard:
# Click "Cancel"
```

**Step 2: Check Build Logs**
```bash
# In Render Dashboard:
# Logs → Build
```

**Step 3: Clear Cache**
```bash
# In Render Dashboard:
# Settings → Clear Build Cache
```

**Step 4: Redeploy**
```bash
# In Render Dashboard:
# Click "Manual Deploy"
```

---

## 14. Database Backup Issues

### Error:
```
Error: Backup failed
Error: Insufficient disk space
```

### Cause:
Database too large or backup storage full

### Solution:

**Step 1: Check Database Size**
```bash
psql -U mello_admin -d mello_db -c "SELECT pg_size_pretty(pg_database_size('mello_db'));"
```

**Step 2: Check Disk Space**
```bash
df -h
```

**Step 3: Clean Old Backups**
```bash
# Remove old backup files
```

**Step 4: Create New Backup**
```bash
pg_dump -U mello_admin mello_db > backup.sql
```

---

## 15. Security Issues

### Error:
```
🚨 Suspicious activity detected
🚨 Data integrity check failed
```

### Cause:
Potential security breach or data tampering

### Solution:

**Step 1: Check Logs**
```bash
# Review security logs
npm start
```

**Step 2: Verify Data Integrity**
```bash
node backend/security/data-integrity.js
```

**Step 3: Check for Unauthorized Changes**
```bash
# Review recent database changes
```

**Step 4: Restore from Backup**
```bash
pg_restore -U mello_admin -d mello_db backup.sql
```

---

## Quick Reference

### Essential Commands

```bash
# Check database
psql -U mello_admin -d mello_db -c "\dt"

# Apply migration
psql -U mello_admin -d mello_db -f database/fix_missing_schema.sql

# Regenerate hash
node backend/regenerate-schema-hash.js

# Start application
npm start

# Check logs
render logs --service-id YOUR_SERVICE_ID

# SSH into service
render ssh --service-id YOUR_SERVICE_ID
```

### Render Dashboard Links

- [Deployments](https://dashboard.render.com/services)
- [Logs](https://dashboard.render.com/services)
- [Environment](https://dashboard.render.com/services)
- [Metrics](https://dashboard.render.com/services)

---

## Getting Help

1. **Check Logs First**
   - Render Dashboard → Logs
   - Look for specific error messages

2. **Review Documentation**
   - RENDER_DEPLOYMENT_GUIDE.md
   - INTEGRATION_GUIDE.md
   - FIXES_APPLIED.md

3. **Test Locally**
   - Reproduce issue locally
   - Check if it's environment-specific

4. **Contact Support**
   - Render Support: https://render.com/support
   - GitHub Issues: https://github.com/adosolve/app.mellominds.co.in/issues

---

**Last Updated**: May 27, 2026
**Status**: Ready for Reference
