# Google OAuth - Detailed Debugging Guide

**Date**: May 27, 2026  
**Status**: ✅ ENHANCED DEBUGGING WITH DETAILED LOGGING

---

## What to Do Now

### Step 1: Restart Backend Server

```bash
cd backend
npm start
```

### Step 2: Watch for Startup Messages

When the backend starts, look for:

```
✅ Google OAuth credentials loaded successfully
```

If you see:
```
❌ CRITICAL: Google OAuth credentials not found in environment variables
  GOOGLE_CLIENT_ID: ✗ Missing
  GOOGLE_CLIENT_SECRET: ✗ Missing
```

Then your `.env` file is missing credentials. **STOP** and fix this first.

### Step 3: Try Google Login

1. Open `http://localhost:5173/login`
2. Click "Login with Google"
3. **Watch the backend terminal** for debug messages

### Step 4: Check Backend Logs

#### Message 1: Route Called
```
[DEBUG] /auth/google route called
[DEBUG] Frontend URL: http://localhost:5173
[DEBUG] Google Client ID: Set
[DEBUG] Google Client Secret: Set
[DEBUG] Google Callback URL: http://localhost:3001/auth/google/callback
```

**What it means**: The frontend successfully called the backend Google OAuth route

**If you don't see this**: The frontend is not calling the backend correctly

#### Message 2: Redirected to Google
After this message, you should be redirected to Google login page. If you're not, there's an issue with the Passport strategy.

#### Message 3: Callback Received
```
[DEBUG] Google callback received
[DEBUG] Query params: { code: '...', state: '...' }
```

**What it means**: Google redirected back to your backend with an authorization code

**If you don't see this**: Google OAuth is not working at all

#### Message 4: Passport Authenticate Called
```
[DEBUG] Passport authenticate callback called
[DEBUG] Error: null
[DEBUG] User: id=123
[DEBUG] Info: undefined
```

**What it means**: Passport successfully authenticated the user

**If Error is not null**: There's an error in the Passport strategy

#### Message 5: Google OAuth Strategy Called
```
[DEBUG] Google OAuth Strategy called
[DEBUG] Profile ID: 1234567890
[DEBUG] Profile emails: 1
[DEBUG] Google OAuth: email=user@gmail.com, userName=John Doe, picture=yes
```

**What it means**: Google returned the user's profile information

**If Profile emails is 0**: Google didn't return an email

#### Message 6: User Created or Updated
```
[DEBUG] Creating new Google user
[DEBUG] Created user: id=123, name=John Doe
```

or

```
[DEBUG] Google user exists: id=123, current_name=John Doe
[DEBUG] Updated existing Google user: id=123, new_name=John Doe
```

**What it means**: The user was created or updated in the database

**If you see an error**: There's a database issue

#### Message 7: Session Saved
```
[DEBUG] Session saved successfully
[DEBUG] Redirecting to dashboard
```

**What it means**: The user is logged in and being redirected to the dashboard

**If you see a session error**: There's an issue with session management

---

## Common Error Messages and Solutions

### Error 1: "Google OAuth credentials not found"

```
❌ CRITICAL: Google OAuth credentials not found in environment variables
  GOOGLE_CLIENT_ID: ✗ Missing
  GOOGLE_CLIENT_SECRET: ✗ Missing
```

**Solution**:
1. Open `backend/.env`
2. Add these lines:
   ```
   GOOGLE_CLIENT_ID=636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
   GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
   ```
3. Restart backend server

### Error 2: "Invalid client"

```
[DEBUG] Google Auth Error: Error: Invalid client
[DEBUG] Error message: Invalid client
```

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Verify your Client ID and Client Secret
3. Update `.env` with correct values
4. Restart backend server

### Error 3: "No email found in Google profile"

```
[DEBUG] Google OAuth: No email found in profile
[DEBUG] Google OAuth error: Error: No email found in Google profile
```

**Solution**:
1. Use a different Google account
2. Make sure the account has a verified email
3. Try again

### Error 4: "User ID not found in database"

```
[DEBUG] Deserialize: User ID 123 not found in database
```

**Solution**:
1. Check that the user was created in the database
2. Check the database connection
3. Restart backend server

### Error 5: "Session Save Error"

```
[DEBUG] Session Save Error: Error: ...
[DEBUG] Session Save Error message: ...
```

**Solution**:
1. Check that SESSION_SECRET is set in `.env`
2. Check that the database connection is working
3. Check that the user_sessions table was created
4. Restart backend server

---

## Complete Debug Flow

Here's what you should see from start to finish:

```
1. Backend starts:
   ✅ Google OAuth credentials loaded successfully

2. You click "Login with Google":
   [DEBUG] /auth/google route called
   [DEBUG] Frontend URL: http://localhost:5173
   [DEBUG] Google Client ID: Set
   [DEBUG] Google Client Secret: Set
   [DEBUG] Google Callback URL: http://localhost:3001/auth/google/callback

3. You're redirected to Google login page
   (no backend logs here - you're on Google's servers)

4. You sign in with Google and authorize the app
   (no backend logs here - you're on Google's servers)

5. Google redirects back to your backend:
   [DEBUG] Google callback received
   [DEBUG] Query params: { code: '...', state: '...' }

6. Passport processes the callback:
   [DEBUG] Passport authenticate callback called
   [DEBUG] Error: null
   [DEBUG] User: id=123
   [DEBUG] Info: undefined

7. Google OAuth Strategy is called:
   [DEBUG] Google OAuth Strategy called
   [DEBUG] Profile ID: 1234567890
   [DEBUG] Profile emails: 1
   [DEBUG] Google OAuth: email=user@gmail.com, userName=John Doe, picture=yes

8. User is created or updated:
   [DEBUG] Creating new Google user
   [DEBUG] Created user: id=123, name=John Doe

9. Session is saved:
   [DEBUG] Session saved successfully
   [DEBUG] Redirecting to dashboard

10. You're logged in!
```

---

## Troubleshooting Checklist

- [ ] Backend is running: `cd backend && npm start`
- [ ] Frontend is running: `cd frontend && npm start`
- [ ] `.env` file has GOOGLE_CLIENT_ID
- [ ] `.env` file has GOOGLE_CLIENT_SECRET
- [ ] `.env` file has GOOGLE_CALLBACK_URL
- [ ] Google Cloud Console has correct redirect URI
- [ ] Browser cookies are cleared
- [ ] Backend logs show "Google OAuth credentials loaded successfully"
- [ ] Backend logs show "/auth/google route called"
- [ ] Backend logs show "Google callback received"
- [ ] Backend logs show "Session saved successfully"

---

## Next Steps

1. **Restart backend server** with the enhanced debugging
2. **Try Google login** and watch the backend logs
3. **Report the exact error message** you see in the logs
4. **Follow the solution** for that specific error

---

## Files Modified

1. `./backend/config/passport.js` - Enhanced logging
2. `./backend/routes/auth.js` - Enhanced logging and error handling

---

**Status**: ✅ DETAILED DEBUGGING ENABLED  
**Last Updated**: May 27, 2026
