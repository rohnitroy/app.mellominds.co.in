# Deployment Guide: Vercel (Frontend) + Render (Backend)

## Architecture
- **Frontend** → Vercel (free tier, React/CRA)
- **Backend** → Render (free tier, Node.js/Express)
- **Database** → Neon or Supabase (free tier, PostgreSQL)

---

## Step 1: Database — Neon (Free PostgreSQL)

1. Go to https://neon.tech and create a free account
2. Create a new project → copy the **Connection String** (looks like `postgresql://user:pass@host/dbname`)
3. Run your SQL schema files against it:
   - `database/create_tables.sql`
   - Any migration files in `backend/database/`

---

## Step 2: Backend — Render

1. Go to https://render.com → New → **Web Service**
2. Connect your GitHub repo, set **Root Directory** to `backend`
3. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add these **Environment Variables** in Render dashboard:

```
NODE_ENV=production
PORT=3000
DB_HOST=<from Neon>
DB_PORT=5432
DB_NAME=<from Neon>
DB_USER=<from Neon>
DB_PASSWORD=<from Neon>
SESSION_SECRET=<generate a long random string>
FRONTEND_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_CALLBACK_URL=https://your-backend.onrender.com/auth/google/callback
```

5. Deploy → copy your Render URL (e.g. `https://mellominds-api.onrender.com`)

---

## Step 3: Frontend — Vercel

1. Go to https://vercel.com → New Project → import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework: **Create React App** (auto-detected)
4. Add this **Environment Variable**:

```
REACT_APP_API_URL=https://your-backend.onrender.com
```

5. Deploy → copy your Vercel URL

---

## Step 4: Update Backend FRONTEND_URL

Go back to Render → update `FRONTEND_URL` to your actual Vercel URL → redeploy.

---

## Step 5: Google OAuth — Update Callback URL

In Google Cloud Console → OAuth 2.0 credentials:
- Add `https://your-backend.onrender.com/auth/google/callback` to **Authorized redirect URIs**
- Add `https://your-app.vercel.app` to **Authorized JavaScript origins**

---

## Important Notes

- Render free tier **spins down after 15 min of inactivity** — first request after idle takes ~30s
- Profile picture uploads (`/uploads`) are **ephemeral on Render** — consider migrating to S3/Cloudinary for persistent storage
- The `SESSION_SECRET` must be a strong random string (use `openssl rand -base64 32`)
