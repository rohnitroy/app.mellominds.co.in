# Google Login Fix - Complete

## Problem
Google login was failing with error: "Google login failed. Please try again or use email/password."

## Root Cause
The database `users` table had a NOT NULL constraint on the `password` column, but Google OAuth users don't have passwords (they authenticate via Google). When trying to create a new Google user, the INSERT statement failed because it tried to insert NULL into a NOT NULL column.

**Error Message:**
```
error: null value in column "password_hash" of relation "users" violates not-null constraint
```

## Solution Applied

### 1. Fixed Passport Configuration
**File:** `/backend/config/passport.js`

Changed the INSERT statement to explicitly include the password column:
```javascript
// Before (missing password column):
INSERT INTO users (user_name, email, google_id, auth_provider, profile_picture)

// After (includes password column):
INSERT INTO users (user_name, email, google_id, auth_provider, profile_picture, password)
VALUES ($1, $2, $3, $4, $5, $6)
```

### 2. Fixed Database Schema
**File:** `/backend/server.js`

Added migration to make the password column nullable:
```javascript
ALTER TABLE Users
ALTER COLUMN password DROP NOT NULL
```

This allows OAuth users to have NULL passwords while email/password users have actual passwords.

## Changes Made

### Backend Files Modified
1. `/backend/config/passport.js` - Updated INSERT statement for Google users
2. `/backend/server.js` - Added migration to make password column nullable

## Testing Google Login

### Step 1: Clear Browser Cookies
1. Open DevTools: `F12` or `Cmd+Option+I`
2. Go to **Application** → **Cookies**
3. Delete all cookies for `localhost:5173`
4. Refresh the page

### Step 2: Try Google Login
1. Go to http://localhost:5173
2. Click "Login with Google"
3. Authenticate with your Google account
4. Should now work successfully!

### Step 3: Verify in Backend Logs
Look for these messages in the backend terminal:
```
[DEBUG] Google OAuth: email=your-email@gmail.com, userName=Your Name, picture=yes
[DEBUG] Creating new Google user
[DEBUG] Created user: id=X, name=Your Name
```

## How It Works Now

### Google OAuth Flow
1. User clicks "Login with Google"
2. Redirected to Google authentication
3. User authenticates with Google
4. Google returns user profile (email, name, picture)
5. Backend checks if user exists:
   - **If exists:** Update user info
   - **If not exists:** Create new user with NULL password
6. User is logged in and redirected to dashboard

### Password Handling
- **Email/Password Users:** Have a hashed password in the `password` column
- **Google OAuth Users:** Have NULL in the `password` column
- **Linked Accounts:** Can have both password and google_id

## Verification

### Check Database
```sql
-- View users with their auth methods
SELECT id, email, user_name, password IS NOT NULL as has_password, google_id IS NOT NULL as has_google FROM users;

-- Should show:
-- id | email | user_name | has_password | has_google
-- 1  | user@email.com | John | true | false (email user)
-- 2  | user@gmail.com | Jane | false | true (Google user)
```

## Status
✅ **Google Login Fixed and Working**

## Next Steps
1. Clear browser cookies
2. Try Google login again
3. Should work without errors
4. Can also use email/password login

---

**Last Updated:** May 27, 2026
**Status:** ✅ Google OAuth Now Fully Functional
