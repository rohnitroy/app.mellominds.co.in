# 🧪 MelloMinds Application - Testing Guide

## Quick Start

### Prerequisites
- Backend running on `http://localhost:3001` ✅
- Frontend running on `http://localhost:5173` ✅
- Database connected ✅
- Google OAuth configured ✅

---

## Test 1: Google OAuth Login Flow

### Steps
1. Open `http://localhost:5173/login` in your browser
2. Click the **"Login with Google"** button
3. You'll be redirected to Google's login page
4. Sign in with your Google account
5. Grant permissions when prompted
6. You should be redirected back to the application

### Expected Results
- ✅ Redirected to Google login page
- ✅ Successfully authenticated with Google
- ✅ Redirected back to application
- ✅ User is logged in
- ✅ Redirected to profile completion or dashboard

### Backend Logs to Check
```
[DEBUG] /auth/google route called
[DEBUG] Google OAuth Strategy called
[DEBUG] Profile ID: [your-google-id]
[DEBUG] Google OAuth: email=[your-email], userName=[your-name]
[DEBUG] Creating new Google user
[DEBUG] Created user: id=[user-id], name=[your-name]
[DEBUG] Google Auth Success: user id = [user-id]
```

---

## Test 2: Profile Completion

### Steps (if redirected to profile completion)
1. Fill in required fields:
   - Phone Number
   - Date of Birth
   - Gender
   - Specialization
   - Languages
   - Country, State, City, Pincode
   - Clinic Address
2. Click **"Complete Profile"**

### Expected Results
- ✅ Profile fields are saved
- ✅ Redirected to dashboard
- ✅ User information is displayed

---

## Test 3: Session Persistence

### Steps
1. After logging in, refresh the page (Cmd+R or F5)
2. Check if you're still logged in

### Expected Results
- ✅ Session persists after refresh
- ✅ User information is still available
- ✅ No need to log in again

---

## Test 4: Logout

### Steps
1. Click the **"Logout"** button (usually in top-right menu)
2. Verify you're redirected to login page

### Expected Results
- ✅ Session is destroyed
- ✅ Redirected to login page
- ✅ Cannot access protected pages without logging in

---

## Test 5: Email/Password Login (if available)

### Steps
1. Go to `http://localhost:5173/login`
2. Click **"Login with Email"** tab
3. Enter email and password
4. Click **"Login"**

### Expected Results
- ✅ Successfully logged in with email/password
- ✅ Redirected to dashboard
- ✅ User information is displayed

---

## Test 6: Database Verification

### Check Google OAuth User Creation
```bash
# Run this in backend directory
node -e "
import pool from './config/database.js';

async function checkUser() {
  const result = await pool.query(
    'SELECT id, user_name, email, auth_provider, password FROM users WHERE auth_provider = \\'google\\' LIMIT 1'
  );
  console.log('Google OAuth User:');
  console.log(result.rows[0]);
  process.exit(0);
}

checkUser();
"
```

### Expected Output
```
Google OAuth User:
{
  id: [user-id],
  user_name: '[Your Name]',
  email: '[your-email@gmail.com]',
  auth_provider: 'google',
  password: null  // ✅ Should be NULL for OAuth users
}
```

---

## Test 7: Appointment Creation

### Steps
1. After logging in, navigate to **"Appointments"** or **"Calendar"**
2. Create a new appointment
3. Fill in appointment details
4. Save the appointment

### Expected Results
- ✅ Appointment is created
- ✅ Appointment appears in calendar
- ✅ Appointment is saved in database

### Database Check
```bash
node -e "
import pool from './config/database.js';

async function checkAppointment() {
  const result = await pool.query(
    'SELECT id, title, start_time, meet_link, google_event_id FROM appointments LIMIT 1'
  );
  console.log('Appointment:');
  console.log(result.rows[0]);
  process.exit(0);
}

checkAppointment();
"
```

---

## Test 8: Session Notes

### Steps
1. After an appointment, navigate to **"Session Notes"**
2. Create a new session note
3. Fill in note details (title, content)
4. Save the note

### Expected Results
- ✅ Session note is created
- ✅ Note appears in list
- ✅ Note is saved in database

### Database Check
```bash
node -e "
import pool from './config/database.js';

async function checkNote() {
  const result = await pool.query(
    'SELECT id, title, content, client_id FROM sessionnotes LIMIT 1'
  );
  console.log('Session Note:');
  console.log(result.rows[0]);
  process.exit(0);
}

checkNote();
"
```

---

## Troubleshooting

### Issue: "Google login failed. Please try again or use email/password."

**Possible Causes:**
1. Backend server not running
2. Google OAuth credentials not configured
3. Database connection failed
4. Password column not nullable

**Solutions:**
1. Check backend is running: `curl http://localhost:3001/health`
2. Verify .env file has Google credentials
3. Check database connection: `node -e "import pool from './config/database.js'; pool.query('SELECT 1'); console.log('Connected'); process.exit(0);"`
4. Verify password column is nullable: See Test 6

### Issue: "Session deserialization failed"

**Possible Causes:**
1. User not found in database
2. Session table corrupted
3. Database connection issue

**Solutions:**
1. Check user exists in database
2. Clear sessions table: `DELETE FROM user_sessions;`
3. Restart backend server

### Issue: "Redirect URI mismatch"

**Possible Causes:**
1. GOOGLE_CALLBACK_URL doesn't match Google Console settings
2. Frontend URL is different from configured URL

**Solutions:**
1. Update GOOGLE_CALLBACK_URL in .env to match Google Console
2. Update FRONTEND_URL in .env to match your frontend URL
3. Restart backend server

---

## Backend Logs

### View Real-time Logs
```bash
# If running with npm start
# Logs appear in the terminal

# If running in background
tail -f backend.log
```

### Key Log Messages
- `✅ Google OAuth credentials loaded successfully` - OAuth configured
- `[DEBUG] Google OAuth Strategy called` - OAuth flow started
- `[DEBUG] Creating new Google user` - New user being created
- `✅ Password_hash column now allows NULL for OAuth users` - Schema fix applied
- `✅ Schema validation passed` - Database schema is valid

---

## Performance Checks

### Backend Response Time
```bash
time curl http://localhost:3001/health
```

Expected: < 100ms

### Database Query Time
```bash
node -e "
import pool from './config/database.js';

async function checkPerformance() {
  const start = Date.now();
  await pool.query('SELECT 1');
  const time = Date.now() - start;
  console.log('Database query time:', time, 'ms');
  process.exit(0);
}

checkPerformance();
"
```

Expected: < 50ms

---

## Security Checks

### Verify Password is Hashed
```bash
node -e "
import pool from './config/database.js';

async function checkPassword() {
  const result = await pool.query(
    'SELECT password FROM users WHERE auth_provider = \\'email\\' LIMIT 1'
  );
  if (result.rows[0]) {
    const pwd = result.rows[0].password;
    console.log('Password starts with \$2b:', pwd.startsWith('\$2b'));
    console.log('Password length:', pwd.length);
    console.log('✅ Password is bcrypt hashed' + (pwd.startsWith('\$2b') ? '' : ' (WARNING: Not hashed)'));
  }
  process.exit(0);
}

checkPassword();
"
```

### Verify OAuth User Has No Password
```bash
node -e "
import pool from './config/database.js';

async function checkOAuth() {
  const result = await pool.query(
    'SELECT password FROM users WHERE auth_provider = \\'google\\' LIMIT 1'
  );
  if (result.rows[0]) {
    const pwd = result.rows[0].password;
    console.log('OAuth user password is NULL:', pwd === null);
    console.log('✅ OAuth user has no password' + (pwd === null ? '' : ' (WARNING: Has password)'));
  }
  process.exit(0);
}

checkOAuth();
"
```

---

## Checklist

- [ ] Backend server running on port 3001
- [ ] Frontend server running on port 5173
- [ ] Database connected
- [ ] Google OAuth credentials configured
- [ ] Google OAuth login flow works
- [ ] User is created in database
- [ ] Session persists after refresh
- [ ] Logout works
- [ ] Appointments can be created
- [ ] Session notes can be created
- [ ] Password is hashed for email users
- [ ] OAuth users have NULL password
- [ ] Schema validation passes
- [ ] No critical errors in logs

---

## Next Steps

After all tests pass:
1. ✅ Application is ready for user acceptance testing
2. ✅ Application is ready for deployment to staging
3. ✅ Application is ready for production deployment

---

**Last Updated**: May 27, 2026  
**Status**: Ready for Testing
