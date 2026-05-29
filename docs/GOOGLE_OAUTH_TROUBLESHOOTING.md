# Google OAuth Login - Troubleshooting Guide

**Status**: Enhanced debugging added  
**Last Updated**: May 27, 2026

---

## Error: "Google login failed. Please try again or use email/password."

This error occurs when the Google OAuth authentication fails. Follow these steps to diagnose and fix the issue.

---

## Step 1: Check Backend Logs

When you click "Login with Google", check the backend terminal for debug messages:

```
[DEBUG] Google callback received
[DEBUG] Query params: { code: '...', state: '...' }
[DEBUG] Google OAuth Strategy called
[DEBUG] Profile ID: 1234567890
[DEBUG] Profile emails: 1
[DEBUG] Google OAuth: email=user@gmail.com, userName=John Doe, picture=yes
[DEBUG] Creating new Google user
[DEBUG] Created user: id=123, name=John Doe
[DEBUG] Google OAuth Strategy: returning user 123
[DEBUG] Session saved successfully
[DEBUG] Redirecting to dashboard
```

### If you see errors instead:

**Error 1: "Google OAuth credentials not found"**
```
❌ CRITICAL: Google OAuth credentials not found in environment variables
  GOOGLE_CLIENT_ID: ✗ Missing
  GOOGLE_CLIENT_SECRET: ✗ Missing
```

**Solution**: Check that `.env` file has these variables:
```
GOOGLE_CLIENT_ID=636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

**Error 2: "No email found in Google profile"**
```
[DEBUG] Google OAuth: No email found in profile
```

**Solution**: This means Google didn't return an email. Check:
1. Google OAuth app has email scope enabled
2. Your Google account has a verified email

**Error 3: "Google Auth Error"**
```
[DEBUG] Google Auth Error: Error: Invalid client
```

**Solution**: Check that:
1. GOOGLE_CLIENT_ID is correct
2. GOOGLE_CLIENT_SECRET is correct
3. Credentials haven't been revoked in Google Cloud Console

---

## Step 2: Verify Google OAuth Configuration

### Check Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to "APIs & Services" → "Credentials"
4. Find your OAuth 2.0 Client ID
5. Click on it and verify:
   - **Client ID** matches `GOOGLE_CLIENT_ID` in `.env`
   - **Client Secret** matches `GOOGLE_CLIENT_SECRET` in `.env`
   - **Authorized redirect URIs** includes `http://localhost:3001/auth/google/callback`

### Add Redirect URI if Missing

1. In Google Cloud Console, click on your OAuth 2.0 Client ID
2. Under "Authorized redirect URIs", click "Add URI"
3. Add: `http://localhost:3001/auth/google/callback`
4. Click "Save"

---

## Step 3: Check Environment Variables

### Verify .env file

```bash
cat backend/.env | grep GOOGLE
```

Should output:
```
GOOGLE_CLIENT_ID=636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

### Verify Variables are Loaded

Check backend logs on startup:
```
✅ Google OAuth credentials loaded successfully
```

If you see:
```
❌ CRITICAL: Google OAuth credentials not found
```

Then:
1. Restart backend server
2. Make sure `.env` file is in `backend/` directory
3. Make sure variables are not commented out

---

## Step 4: Check Network Requests

### Open Browser Developer Tools

1. Press `F12` to open Developer Tools
2. Go to "Network" tab
3. Click "Login with Google"
4. Look for requests to:
   - `accounts.google.com` - Google login page
   - `localhost:3001/auth/google/callback` - Callback from Google

### Check for Errors

If you see a failed request to `localhost:3001/auth/google/callback`:
1. Check the response status code
2. Check the response body for error message
3. Check backend logs for corresponding error

---

## Step 5: Test Google OAuth Flow

### Manual Test

1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm start`
3. Open browser to `http://localhost:5173/login`
4. Click "Login with Google"
5. You should be redirected to Google login
6. After login, you should be redirected back to the app

### Expected Flow

```
1. Click "Login with Google"
   ↓
2. Redirected to: https://accounts.google.com/o/oauth2/v2/auth?...
   ↓
3. Sign in with Google account
   ↓
4. Redirected to: http://localhost:3001/auth/google/callback?code=...&state=...
   ↓
5. Backend processes callback
   ↓
6. Redirected to: http://localhost:5173/ (dashboard)
```

---

## Step 6: Common Issues and Solutions

### Issue 1: Redirect Loop

**Symptom**: Clicking "Login with Google" redirects back to login page

**Causes**:
- Google credentials are invalid
- Callback URL doesn't match
- Session not being saved

**Solutions**:
1. Verify Google credentials in `.env`
2. Verify callback URL in Google Cloud Console
3. Check backend logs for session errors
4. Clear browser cookies and try again

### Issue 2: "Invalid client" Error

**Symptom**: Backend logs show "Invalid client"

**Causes**:
- GOOGLE_CLIENT_ID is wrong
- GOOGLE_CLIENT_SECRET is wrong
- Credentials have been revoked

**Solutions**:
1. Double-check credentials in `.env`
2. Regenerate credentials in Google Cloud Console
3. Update `.env` with new credentials
4. Restart backend server

### Issue 3: "No email found" Error

**Symptom**: Backend logs show "No email found in Google profile"

**Causes**:
- Google account doesn't have email
- Email scope not requested
- Google account privacy settings

**Solutions**:
1. Use a different Google account with verified email
2. Check that email scope is in the request
3. Check Google account privacy settings

### Issue 4: Session Not Saved

**Symptom**: Logged in but redirected back to login page

**Causes**:
- Session secret not set
- Database session table not created
- Cookie settings incorrect

**Solutions**:
1. Verify SESSION_SECRET in `.env` (min 32 chars)
2. Check backend logs for session errors
3. Verify database connection
4. Clear browser cookies

### Issue 5: CORS Error

**Symptom**: Browser console shows CORS error

**Causes**:
- Frontend URL not in CORS whitelist
- Credentials not being sent

**Solutions**:
1. Verify FRONTEND_URL in `.env`
2. Verify CORS configuration in server.js
3. Make sure credentials are being sent in requests

---

## Step 7: Debug Mode

### Enable Detailed Logging

The backend now includes detailed debug logging. Check for these messages:

```
[DEBUG] Google callback received
[DEBUG] Query params: { code: '...', state: '...' }
[DEBUG] Google OAuth Strategy called
[DEBUG] Profile ID: ...
[DEBUG] Profile emails: ...
[DEBUG] Google OAuth: email=..., userName=..., picture=...
[DEBUG] Creating new Google user
[DEBUG] Created user: id=..., name=...
[DEBUG] Google OAuth Strategy: returning user ...
[DEBUG] Session saved successfully
[DEBUG] Redirecting to dashboard
```

### Check for Errors

Look for error messages like:
```
[DEBUG] Google Auth Error: ...
[DEBUG] Error stack: ...
[DEBUG] Session Save Error: ...
```

---

## Step 8: Reset and Try Again

If nothing works, try a complete reset:

### 1. Clear Browser Data
- Open DevTools (F12)
- Go to "Application" tab
- Clear all cookies and storage
- Close browser

### 2. Restart Backend
```bash
cd backend
npm start
```

### 3. Restart Frontend
```bash
cd frontend
npm start
```

### 4. Try Login Again
- Open `http://localhost:5173/login`
- Click "Login with Google"
- Check backend logs for debug messages

---

## Step 9: Production Deployment

When deploying to production, update these variables:

```
GOOGLE_CALLBACK_URL=https://app.mellominds.co.in/auth/google/callback
FRONTEND_URL=https://app.mellominds.co.in
```

And add to Google Cloud Console:
- Authorized redirect URI: `https://app.mellominds.co.in/auth/google/callback`

---

## Checklist

- [ ] GOOGLE_CLIENT_ID is set in `.env`
- [ ] GOOGLE_CLIENT_SECRET is set in `.env`
- [ ] GOOGLE_CALLBACK_URL is set in `.env`
- [ ] Callback URL matches Google Cloud Console
- [ ] Backend server is running
- [ ] Frontend server is running
- [ ] Browser cookies are cleared
- [ ] Backend logs show debug messages
- [ ] No CORS errors in browser console
- [ ] Google account has verified email

---

## Support

If you're still having issues:

1. Check backend logs for error messages
2. Check browser console for errors
3. Verify all environment variables
4. Verify Google Cloud Console configuration
5. Try with a different Google account
6. Restart both servers

---

**Status**: ✅ Enhanced debugging added  
**Last Updated**: May 27, 2026
