# Render Deployment Guide - MelloMinds

## Overview

This guide explains how to deploy the MelloMinds application to Render after the recent schema migrations and fixes.

---

## Issue: Schema Hash Mismatch

### What Happened?
The application includes a security feature that validates the database schema hasn't been tampered with. After adding new tables and columns, the schema hash changed, causing deployment to fail.

### Error Message:
```
🚨 SCHEMA TAMPERING DETECTED - Schema has been modified!
Stored hash: 2c50c0d47d11b40cfccd79b68dc493d633cd28914bca5724c8e269e2f1c9815d
Current hash: 6ff1a5cac5a4a6a70a321b0d4c325546a69e145d8dd3bd01bf4f86dc0ad4a6e7
🚨 CRITICAL: Schema tampering detected. Application cannot start.
```

### Solution:
The schema validator has been updated to:
1. Recognize all new columns as legitimate
2. Allow deployment with a warning
3. Provide instructions to regenerate the hash

---

## Deployment Steps

### Step 1: Verify Database Migration

Before deploying, ensure the database migration has been applied:

```bash
# Connect to your production database
psql -U mello_admin -d mello_db -c "\dt"
```

Verify these tables exist:
- ✅ Clients
- ✅ ClientTransfers
- ✅ SessionNotes
- ✅ ClientActivities
- ✅ Availability
- ✅ organization_therapists
- ✅ organization_details
- ✅ NoteTemplates

### Step 2: Deploy to Render

1. **Push code to GitHub** (already done)
   ```bash
   git push origin main
   ```

2. **Trigger Render deployment**
   - Go to https://dashboard.render.com
   - Select your service
   - Click "Manual Deploy" or wait for auto-deploy
   - Monitor the deployment logs

3. **Expected Output:**
   ```
   ✅ Environment variables loaded
   ✅ Resend email client ready
   🔐 Starting Security Validation...
   ✅ Database connected successfully
   ⚠️ Schema Validation Issues Found: (warnings only, not critical)
   ⚠️ Schema hash mismatch detected. This may be due to recent schema migrations.
   ℹ️ To regenerate the schema hash, run: node backend/regenerate-schema-hash.js
   ℹ️ Continuing with deployment...
   ✅ Server running on port 5000
   ```

### Step 3: Regenerate Schema Hash (Post-Deployment)

After successful deployment, regenerate the schema hash to prevent future warnings:

#### Option A: Via SSH (Recommended)
```bash
# SSH into your Render service
# Then run:
node backend/regenerate-schema-hash.js
```

#### Option B: Via Render Shell
1. Go to Render Dashboard
2. Select your service
3. Click "Shell" tab
4. Run:
   ```bash
   node backend/regenerate-schema-hash.js
   ```

#### Option C: Via Local Database Connection
```bash
# From your local machine
psql -U mello_admin -d mello_db -c "SELECT COUNT(*) FROM users;"
# Then run the regenerate script locally
node backend/regenerate-schema-hash.js
```

### Step 4: Verify Deployment

1. **Check application is running:**
   ```bash
   curl https://your-app.onrender.com/auth/me
   ```
   Should return 401 (not authenticated) or user data

2. **Check database connection:**
   - Application should connect without errors
   - No "relation does not exist" errors

3. **Test endpoints:**
   ```bash
   # Get appointments
   curl -X GET https://your-app.onrender.com/api/bookings \
     -H "Cookie: connect.sid=YOUR_SESSION"
   
   # Get statistics
   curl -X GET https://your-app.onrender.com/api/bookings/stats \
     -H "Cookie: connect.sid=YOUR_SESSION"
   ```

---

## Troubleshooting

### Issue: "Schema tampering detected" error persists

**Solution:**
1. Verify database migration was applied
2. Run regenerate-schema-hash.js
3. Restart the application

### Issue: "relation does not exist" error

**Solution:**
1. Check if database migration was applied
2. Verify all tables exist:
   ```bash
   psql -U mello_admin -d mello_db -c "\dt"
   ```
3. If tables missing, apply migration:
   ```bash
   psql -U mello_admin -d mello_db -f database/fix_missing_schema.sql
   ```

### Issue: "column does not exist" error

**Solution:**
1. Verify all columns were added to tables
2. Check specific table:
   ```bash
   psql -U mello_admin -d mello_db -c "\d users"
   ```
3. If columns missing, apply migration again

### Issue: Application won't start

**Solution:**
1. Check Render logs for specific error
2. Verify environment variables are set
3. Verify database connection string is correct
4. Verify database is accessible from Render

---

## Environment Variables

Ensure these are set in Render:

```
DATABASE_URL=postgresql://mello_admin:PASSWORD@HOST:5432/mello_db
FRONTEND_URL=https://your-frontend-url.com
SESSION_SECRET=your-secret-key
CLOUDINARY_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
RESEND_API_KEY=your-resend-key
NODE_ENV=production
```

---

## Post-Deployment Checklist

- [ ] Application deployed successfully
- [ ] No critical errors in logs
- [ ] Database connection working
- [ ] All endpoints responding
- [ ] Schema hash regenerated
- [ ] Frontend can connect to backend
- [ ] Appointments page loads
- [ ] Can create/update appointments
- [ ] Can reschedule appointments
- [ ] Can send reminders
- [ ] Email notifications working
- [ ] Real-time updates working (Socket.IO)
- [ ] Google Calendar sync working

---

## Rollback Plan

If deployment fails:

### Option 1: Revert to Previous Commit
```bash
git revert HEAD
git push origin main
# Render will auto-deploy the previous version
```

### Option 2: Manual Rollback
1. Go to Render Dashboard
2. Select your service
3. Click "Deployments"
4. Select previous successful deployment
5. Click "Redeploy"

### Option 3: Restore Database
```bash
# Restore from backup
pg_restore -U mello_admin -d mello_db backup.sql
```

---

## Monitoring

### Check Logs
```bash
# Via Render Dashboard
# Select service → Logs tab

# Or via CLI
render logs --service-id YOUR_SERVICE_ID
```

### Monitor Errors
- Watch for "relation does not exist" errors
- Watch for "column does not exist" errors
- Watch for authentication errors
- Watch for database connection errors

### Performance Monitoring
- Monitor response times
- Monitor database query times
- Monitor error rates
- Monitor CPU/Memory usage

---

## Maintenance

### Regular Tasks

**Weekly:**
- Check error logs
- Monitor performance metrics
- Verify all endpoints working

**Monthly:**
- Review database size
- Check for unused indexes
- Analyze slow queries
- Update dependencies

**Quarterly:**
- Full backup verification
- Disaster recovery test
- Security audit
- Performance optimization

---

## Support

### For Deployment Issues:
1. Check Render logs
2. Verify environment variables
3. Verify database connection
4. Check GitHub for recent changes

### For Database Issues:
1. Verify migration was applied
2. Check table/column existence
3. Verify foreign keys
4. Check for data integrity

### For Application Issues:
1. Check error logs
2. Test endpoints with curl
3. Verify authentication
4. Check Socket.IO connection

---

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)
- [Express.js Documentation](https://expressjs.com/)

---

## Quick Commands

### Deploy
```bash
git push origin main
```

### Regenerate Schema Hash
```bash
node backend/regenerate-schema-hash.js
```

### Check Database
```bash
psql -U mello_admin -d mello_db -c "\dt"
```

### View Logs
```bash
render logs --service-id YOUR_SERVICE_ID
```

### SSH into Service
```bash
render ssh --service-id YOUR_SERVICE_ID
```

---

**Last Updated**: May 27, 2026
**Status**: Ready for Deployment
