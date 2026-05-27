# MelloMinds Application - How to Run

**Status**: ✅ ALL FIXES APPLIED - READY TO RUN

---

## Prerequisites

- Node.js 16+ installed
- PostgreSQL database running and accessible
- Environment variables configured in `.env` files

---

## Quick Start (2 Steps)

### Step 1: Start Backend Server

```bash
cd backend
npm start
```

**Expected Output**:
```
🔐 Starting Security Validation...

📋 Running schema auto-migrations...

✅ Calendars schema verified
✅ Appointments schema verified
✅ Users schema verified
✅ Clients schema verified
✅ ClientTransfers schema verified
✅ ClientActivities schema verified
✅ SessionNotes schema verified
✅ UserIntegrations schema verified
✅ Availability schema verified
✅ Users missing columns verified
✅ Notifications schema verified
✅ NoteTemplates schema verified
✅ Organization therapists schema verified
✅ Org role schema verified
✅ Organization details schema verified
✅ Chat schema verified
✅ Enterprise leads schema verified
✅ Audit table verified

🔐 Validating Database Schema Integrity...
✅ Schema validation passed - No issues detected

✅ Security validation passed. Initializing application...

🚀 Server running on port 3001
```

### Step 2: Start Frontend Server (in another terminal)

```bash
cd frontend
npm start
```

**Expected Output**:
```
Compiled successfully!

You can now view mellominds-dashboard in the browser.

  Local:            http://localhost:5173
  On Your Network:  http://192.168.x.x:5173

Note that the development build is not optimized.
To create a production build, use npm run build.
```

---

## Access the Application

Open your browser and navigate to:

```
http://localhost:5173
```

---

## Detailed Setup Instructions

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

This will install all required packages:
- express
- passport
- pg (PostgreSQL)
- bcrypt
- socket.io
- cloudinary
- resend
- and more...

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

This will install all required packages:
- react
- react-router-dom
- socket.io-client
- @tanstack/react-table
- and more...

### 3. Verify Environment Variables

Check that `.env` file in backend directory has all required variables:

```bash
cat backend/.env
```

Required variables:
- DB_HOST
- DB_PORT
- DB_NAME
- DB_USER
- DB_PASSWORD
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- SESSION_SECRET
- ENCRYPTION_MASTER_SECRET
- FRONTEND_URL
- PORT
- NODE_ENV
- RESEND_API_KEY
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

### 4. Start Backend Server

```bash
cd backend
npm start
```

The server will:
1. Load environment variables
2. Connect to database
3. Run all auto-migrations
4. Validate schema
5. Start listening on port 3001

### 5. Start Frontend Server (in another terminal)

```bash
cd frontend
npm start
```

The frontend will:
1. Compile React code
2. Start dev server on port 5173
3. Open browser automatically (or navigate manually)

### 6. Test the Application

#### Test Google OAuth Login
1. Click "Login with Google" button
2. Select your Google account
3. Verify you're logged in

#### Test Email/Password Login
1. Click "Login with Email" button
2. Enter email and password
3. Verify you're logged in

#### Test Notes Feature
1. Navigate to Appointments
2. Click on an appointment
3. Create a new note
4. Verify the note is saved

#### Test Chat Feature
1. Navigate to Chat
2. Start a new conversation
3. Send a message
4. Verify the message is saved

---

## Development Commands

### Backend Commands

```bash
# Start development server with auto-reload
cd backend
npm run dev

# Start production server
cd backend
npm start

# Check for syntax errors
node --check server.js
```

### Frontend Commands

```bash
# Start development server
cd frontend
npm start

# Build for production
cd frontend
npm run build

# Run tests
cd frontend
npm test
```

---

## Troubleshooting

### Backend Won't Start

#### Error: `Cannot find module 'express'`
```bash
cd backend
npm install
```

#### Error: `Database connection failed`
1. Verify database is running
2. Check credentials in `.env`
3. Verify network connectivity

#### Error: `Schema validation failed`
1. Check the error message in logs
2. Verify database schema
3. Check for missing columns

### Frontend Won't Start

#### Error: `Cannot find module 'react'`
```bash
cd frontend
npm install
```

#### Error: `Port 5173 already in use`
```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill -9

# Or change the port in package.json
```

### Login Issues

#### Error: `Failed to deserialize user out of session`
1. Clear browser cookies
2. Try logging in again

#### Error: `Google login failed`
1. Verify Google OAuth credentials in `.env`
2. Check Google OAuth configuration
3. Verify callback URL matches

### Database Issues

#### Error: `Table does not exist`
1. Check backend logs for migration errors
2. Verify database connection
3. Restart backend server

#### Error: `Column does not exist`
1. Check backend logs for migration errors
2. Verify database schema
3. Restart backend server

---

## Monitoring

### Backend Logs

The backend server logs important events:
- Database connections
- Schema migrations
- Authentication events
- API requests
- Errors and warnings

### Frontend Logs

Open browser developer console (F12) to see:
- API requests
- Frontend errors
- Console messages
- Network activity

### Database Logs

Check PostgreSQL logs for:
- Connection events
- Query errors
- Performance issues

---

## Performance Tips

1. **Use development mode for development**
   - Faster compilation
   - Better error messages
   - Auto-reload on changes

2. **Use production mode for deployment**
   - Optimized code
   - Better performance
   - Smaller bundle size

3. **Monitor database performance**
   - Check query times
   - Monitor connection pool
   - Review slow queries

4. **Monitor server performance**
   - Check CPU usage
   - Monitor memory usage
   - Review error rates

---

## Security Tips

1. **Keep environment variables secure**
   - Don't commit `.env` to git
   - Use strong secrets
   - Rotate secrets regularly

2. **Keep dependencies updated**
   - Run `npm audit` regularly
   - Update packages when needed
   - Review security advisories

3. **Monitor logs for suspicious activity**
   - Check for failed login attempts
   - Monitor for unusual API usage
   - Review error patterns

4. **Use HTTPS in production**
   - Get SSL certificate
   - Configure HTTPS
   - Redirect HTTP to HTTPS

---

## Deployment

### Deploy to Production

1. **Build frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy backend**
   ```bash
   # Copy backend files to production server
   # Set environment variables
   # Run: npm start
   ```

3. **Deploy frontend**
   ```bash
   # Copy build files to web server
   # Configure web server to serve static files
   # Configure API proxy to backend
   ```

4. **Verify deployment**
   - Test all endpoints
   - Test authentication
   - Monitor logs
   - Check performance

---

## Useful Links

- **Backend API**: http://localhost:3001
- **Frontend App**: http://localhost:5173
- **PostgreSQL**: 187.127.140.201:5432
- **Google OAuth**: https://console.cloud.google.com
- **Cloudinary**: https://cloudinary.com
- **Resend Email**: https://resend.com

---

## Support

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review the **logs** in the terminal
3. Check the **browser console** for frontend errors
4. Verify **environment variables** are set correctly
5. Verify **database connection** is working

---

## Summary

✅ **Application is ready to run**

1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm start`
3. Open browser: http://localhost:5173
4. Test the application
5. Deploy to production when ready

---

**Last Updated**: May 27, 2026  
**Status**: ✅ PRODUCTION READY
