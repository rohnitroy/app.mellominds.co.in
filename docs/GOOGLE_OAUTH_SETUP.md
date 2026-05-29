# Google OAuth Setup Guide

## 📋 Prerequisites
- Node.js installed
- PostgreSQL database running
- Google Cloud Console account

---

## 🗄️ Step 1: Database Setup

### Option A: New Database
Run the updated schema:
```bash
psql -U postgres -f create_tables.sql
```

### Option B: Existing Database
Run the migration:
```bash
psql -U postgres -f migrate_oauth.sql
```

---

## 🔑 Step 2: Google Cloud Console Setup

1. **Go to**: https://console.cloud.google.com/

2. **Create/Select Project**
   - Click "Select a project" → "New Project"
   - Name it "MelloMinds Auth"

3. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search "Google+ API"
   - Click "Enable"

4. **Create OAuth Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "MelloMinds Web Client"
   
   **Authorized JavaScript origins:**
   ```
   http://localhost:5173
   ```
   
   **Authorized redirect URIs:**
   ```
   http://localhost:3000/auth/google/callback
   ```

5. **Copy Credentials**
   - Copy "Client ID" and "Client Secret"
   - You'll need these for the `.env` file

---

## ⚙️ Step 3: Backend Setup

1. **Navigate to backend folder:**
```bash
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create `.env` file:**
```bash
copy .env.example .env
```

4. **Edit `.env` file with your credentials:**
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mello_db
DB_USER=mello_admin
DB_PASSWORD=your_actual_password

# Google OAuth (paste from Google Console)
GOOGLE_CLIENT_ID=your_actual_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_actual_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Session Secret (generate random string)
SESSION_SECRET=generate_a_random_string_here_min_32_chars

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Server Port
PORT=3000
```

5. **Start backend server:**
```bash
npm run dev
```

You should see:
```
✅ Database connected successfully
🚀 Server running on http://localhost:3000
```

---

## 🎨 Step 4: Frontend Setup

1. **Navigate to frontend folder:**
```bash
cd mellominds-therapistdashboard-phase1
```

2. **Start frontend:**
```bash
npm run dev
```

Frontend will run on: http://localhost:5173

---

## 🧪 Step 5: Test Authentication

### Test Google Login:
1. Open http://localhost:5173
2. Click "Login with Google Account"
3. Select your Google account
4. You'll be redirected to dashboard (create this page if needed)

### Test Email/Password Login:
1. First, register a user with password (you need to create signup endpoint)
2. Use email and password to login

---

## 📁 Project Structure

```
Mellominds/
├── backend/
│   ├── config/
│   │   ├── database.js       # PostgreSQL connection
│   │   └── passport.js       # Google OAuth strategy
│   ├── middleware/
│   │   └── auth.js           # Authentication middleware
│   ├── routes/
│   │   └── auth.js           # Login/logout routes
│   ├── server.js             # Main Express server
│   ├── package.json
│   ├── .env                  # Your credentials (DO NOT COMMIT)
│   └── .env.example          # Template
├── mellominds-therapistdashboard-phase1/
│   └── src/
│       └── components/
│           └── LoginPage.tsx # Updated with OAuth
├── create_tables.sql         # Updated schema
└── migrate_oauth.sql         # Migration for existing DB
```

---

## 🔐 How Google OAuth Works

### Flow Diagram:
```
User clicks "Login with Google"
    ↓
Frontend redirects to: http://localhost:3000/auth/google
    ↓
Backend redirects to: Google Login Page
    ↓
User selects Google account
    ↓
Google redirects to: http://localhost:3000/auth/google/callback
    ↓
Backend receives user info from Google
    ↓
Backend checks if user exists in database:
    - If exists: Login user
    - If new: Create user account
    ↓
Backend creates session and redirects to: http://localhost:5173/dashboard
    ↓
User is logged in!
```

### What Happens in Database:
1. **New Google User**: Creates user with `auth_provider='google'`, no password
2. **Existing Email User**: Links Google account to existing user
3. **Returning Google User**: Logs in directly

---

## 🛡️ Security Features

✅ **Password hashing** with bcrypt  
✅ **Session-based authentication**  
✅ **CORS protection**  
✅ **SQL injection prevention** (parameterized queries)  
✅ **Secure session cookies**  
✅ **OAuth 2.0 standard**  

---

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
- Check Google Console redirect URIs match exactly
- Must be: `http://localhost:3000/auth/google/callback`

### Error: "Database connection failed"
- Verify PostgreSQL is running
- Check `.env` database credentials
- Test connection: `psql -U mello_admin -d mello_db`

### Error: "CORS policy blocked"
- Ensure backend is running on port 3000
- Ensure frontend is running on port 5173
- Check `FRONTEND_URL` in `.env`

### Error: "Session not persisting"
- Check `SESSION_SECRET` is set in `.env`
- Ensure `credentials: 'include'` in frontend fetch calls

---

## 📝 Next Steps

1. **Create Dashboard Page** - Where users land after login
2. **Add Signup Endpoint** - For email/password registration
3. **Add Password Reset** - Forgot password functionality
4. **Production Setup** - Use HTTPS, secure cookies, environment variables

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Email/password login |
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Google OAuth callback |
| POST | `/auth/logout` | Logout user |
| GET | `/auth/me` | Get current user |
| GET | `/health` | Server health check |

---

## 📞 Support

If you encounter issues:
1. Check backend console for errors
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure both servers are running

---

**Created by: Amazon Q Developer**  
**Last Updated: 2024**
