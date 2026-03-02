# Vercel Environment Variables

## How to Add Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable below
5. Select environment: **Production**, **Preview**, and **Development**
6. Click **Save**

---

## Backend Environment Variables

Copy and paste these in Vercel Dashboard for your **BACKEND** project:

### Database Configuration
```
DB_HOST=72.60.103.151
DB_PORT=5433
DB_NAME=mello_db
DB_USER=postgres
DB_PASSWORD=aikimkc
```

### Google OAuth Configuration
```
GOOGLE_CLIENT_ID=636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### URLs (Update after deployment)
```
GOOGLE_CALLBACK_URL=https://YOUR-BACKEND-URL.vercel.app/auth/google/callback
FRONTEND_URL=https://app-mellominds-co-in.vercel.app
```

### Session & Server
```
SESSION_SECRET=mellominds_secret_key_change_this_in_production_2024
PORT=3000
```

### AWS (Optional)
```
AWS_REGION=us-east-1
DYNAMODB_TABLE=saas-app-data
```

---

## Frontend Environment Variables

Copy and paste these in Vercel Dashboard for your **FRONTEND** project:

```
REACT_APP_API_URL=https://YOUR-BACKEND-URL.vercel.app
```

---

## Important Notes

⚠️ **After Backend Deployment:**
1. Get your backend URL from Vercel (e.g., `https://backend-abc123.vercel.app`)
2. Update these variables:
   - Backend: `GOOGLE_CALLBACK_URL` → Replace `YOUR-BACKEND-URL` with actual URL
   - Frontend: `REACT_APP_API_URL` → Replace `YOUR-BACKEND-URL` with actual URL
3. Redeploy both projects after updating variables

⚠️ **Update Google Cloud Console:**
After deployment, add these to Google OAuth:
- Authorized redirect URIs:
  - `https://YOUR-BACKEND-URL.vercel.app/auth/google/callback`
  - `https://YOUR-BACKEND-URL.vercel.app/api/connect-calendar/callback`
- Authorized JavaScript origins:
  - `https://YOUR-BACKEND-URL.vercel.app`
  - `https://app-mellominds-co-in.vercel.app`

---

## Quick Copy Format (for Vercel UI)

### Backend Variables (one per line):
```
DB_HOST
72.60.103.151

DB_PORT
5433

DB_NAME
mello_db

DB_USER
postgres

DB_PASSWORD
aikimkc

GOOGLE_CLIENT_ID
636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com

GOOGLE_CLIENT_SECRET
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

GOOGLE_CALLBACK_URL
https://YOUR-BACKEND-URL.vercel.app/auth/google/callback

SESSION_SECRET
mellominds_secret_key_change_this_in_production_2024

FRONTEND_URL
https://app-mellominds-co-in.vercel.app

PORT
3000

AWS_REGION
us-east-1

DYNAMODB_TABLE
saas-app-data
```

### Frontend Variables:
```
REACT_APP_API_URL
https://YOUR-BACKEND-URL.vercel.app
```

---

## Deployment Order

1. ✅ Add backend environment variables in Vercel
2. ✅ Deploy backend → Get backend URL
3. ✅ Update `GOOGLE_CALLBACK_URL` in backend with actual URL
4. ✅ Add frontend environment variables in Vercel (use backend URL)
5. ✅ Deploy frontend
6. ✅ Update Google Cloud Console with production URLs
7. ✅ Test the application

---

## Security Reminder

🔒 Never commit `.env` files to Git
🔒 These credentials are sensitive - keep them secure
🔒 Consider rotating `SESSION_SECRET` for production
🔒 Use Vercel's environment variable encryption
