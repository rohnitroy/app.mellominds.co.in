# Session Deserialization Error - Fix Guide

## Error Message
```
{"error":"Internal Server Error","message":"Failed to deserialize user out of session"}
```

## What Causes This Error

This error occurs when:
1. **Old Session Cookie:** Browser has a session cookie with a user ID that no longer exists in the database
2. **User Deleted:** The user account was deleted but the session cookie remains
3. **Database Issue:** The database connection fails during session deserialization
4. **Session Corruption:** The session data is corrupted or invalid

## Quick Fix - Clear Browser Cookies

### Option 1: Clear All Cookies (Easiest)
1. Open DevTools: `F12` or `Cmd+Option+I`
2. Go to **Application** tab
3. Click **Cookies** → **http://localhost:5173**
4. Delete all cookies
5. Refresh the page: `Cmd+R` or `Ctrl+R`

### Option 2: Clear Specific Session Cookie
1. Open DevTools: `F12`
2. Go to **Application** → **Cookies**
3. Find cookie named `connect.sid` (session cookie)
4. Delete it
5. Refresh the page

### Option 3: Incognito/Private Window
1. Open a new Incognito/Private window
2. Navigate to http://localhost:5173
3. This will have no cookies and should work

## Backend Fixes Applied

### 1. Improved Error Handling in Passport
**File:** `/backend/config/passport.js`

Added better error handling in `deserializeUser`:
- Checks if user ID exists
- Returns `false` instead of throwing error if user not found
- Logs debug information for troubleshooting

### 2. Session Recovery Middleware
**File:** `/backend/server.js`

Added middleware that:
- Detects when session exists but user can't be deserialized
- Automatically clears the invalid session
- Allows user to log in again

### 3. Session Check Endpoint
**File:** `/backend/routes/auth.js`

New endpoint: `GET /auth/session-check`
- Returns current session status
- Useful for debugging session issues
- Test with: `curl http://localhost:3001/auth/session-check`

## Testing the Fix

### Test 1: Check Session Status
```bash
curl http://localhost:3001/auth/session-check
```

Expected response if authenticated:
```json
{"authenticated": true, "user": {...}}
```

Expected response if not authenticated:
```json
{"authenticated": false, "message": "Not authenticated"}
```

### Test 2: Login Flow
1. Clear cookies (see above)
2. Go to http://localhost:5173
3. Register or login
4. Should work without errors

### Test 3: Logout and Login Again
1. Click logout
2. Try to login again
3. Should work smoothly

## If Error Persists

### Step 1: Check Backend Logs
Look for messages like:
```
[DEBUG] Deserialize: User ID X not found in database
[DEBUG] Session deserialization failed, clearing session
```

### Step 2: Verify Database Connection
```bash
# Test backend health
curl http://localhost:3001/health

# Should return:
# {"status":"OK","message":"Server is running"}
```

### Step 3: Check User Exists in Database
```sql
-- Connect to database and run:
SELECT id, email, user_name FROM users LIMIT 5;
```

### Step 4: Clear Session Store
The session is stored in the `user_sessions` table. To clear all sessions:
```sql
DELETE FROM user_sessions;
```

Then refresh the browser.

## Prevention

### For Development
- Always clear cookies when switching between different user accounts
- Use incognito windows for testing different scenarios
- Check backend logs for deserialization errors

### For Production
- Implement session timeout (currently 8 hours)
- Add session validation on every request
- Monitor for deserialization errors
- Implement graceful session recovery

## Session Configuration

**File:** `/backend/server.js`

Current session settings:
```javascript
cookie: {
  secure: isProduction,        // HTTPS only in production
  httpOnly: true,              // Not accessible from JavaScript
  maxAge: 8 * 60 * 60 * 1000,  // 8 hours
  sameSite: isProduction ? 'none' : 'lax',
  domain: isProduction ? '.mellominds.co.in' : undefined,
}
```

## Troubleshooting Checklist

- [ ] Cleared browser cookies
- [ ] Tried incognito/private window
- [ ] Backend is running (`npm run dev` in `/backend`)
- [ ] Frontend is running (`npm start` in `/frontend`)
- [ ] Database is accessible
- [ ] No errors in backend logs
- [ ] Tried logging out and logging back in
- [ ] Tried hard refresh (Cmd+Shift+R)

## Still Having Issues?

1. **Check Backend Logs:**
   ```
   Look for [DEBUG] messages in terminal running backend
   ```

2. **Test Session Endpoint:**
   ```bash
   curl http://localhost:3001/auth/session-check
   ```

3. **Clear Everything:**
   ```bash
   # Stop both servers
   # Clear browser cookies
   # Delete session table
   # Restart servers
   # Try again
   ```

4. **Check Database:**
   - Verify database is running
   - Verify user exists in `users` table
   - Verify `user_sessions` table exists

## Related Files

- `/backend/config/passport.js` - Passport configuration
- `/backend/server.js` - Session middleware setup
- `/backend/routes/auth.js` - Authentication endpoints
- `/backend/config/database.js` - Database connection

---

**Last Updated:** May 27, 2026
**Status:** ✅ Session Error Handling Improved
