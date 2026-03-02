# Deployment Checklist

## ✅ What's Ready

### Database
- [x] PostgreSQL configured at 72.60.103.151:5433
- [x] Database: mello_db
- [x] User: postgres
- [x] Tables created (Users, Calendars, Appointments, etc.)

### Google OAuth
- [x] Client ID: 636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com
- [x] Client Secret: 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
- [x] Redirect URIs configured for production

### Application
- [x] Backend code ready
- [x] Frontend code ready
- [x] Environment variables documented
- [x] Vercel configuration files created

## 📋 Deployment Steps

### 1. Deploy Backend to Vercel
```bash
cd backend
vercel --prod
```
**Save the backend URL** (e.g., https://backend-xyz.vercel.app)

### 2. Add Backend Environment Variables in Vercel
Go to Vercel Dashboard → Backend Project → Settings → Environment Variables:
- DB_HOST=72.60.103.151
- DB_PORT=5433
- DB_NAME=mello_db
- DB_USER=postgres
- DB_PASSWORD=aikimkc
- GOOGLE_CLIENT_ID=636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com
- GOOGLE_CLIENT_SECRET=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
- GOOGLE_CALLBACK_URL=https://YOUR-BACKEND-URL.vercel.app/auth/google/callback
- SESSION_SECRET=mellominds_secret_key_change_this_in_production_2024
- FRONTEND_URL=https://app-mellominds-co-in.vercel.app
- PORT=3000

### 3. Deploy Frontend to Vercel
```bash
cd frontend
vercel --prod
```

### 4. Add Frontend Environment Variables in Vercel
Go to Vercel Dashboard → Frontend Project → Settings → Environment Variables:
- REACT_APP_API_URL=https://YOUR-BACKEND-URL.vercel.app

### 5. Update Google Cloud Console
Add production URLs to Authorized redirect URIs:
- https://YOUR-BACKEND-URL.vercel.app/auth/google/callback
- https://YOUR-BACKEND-URL.vercel.app/api/connect-calendar/callback

Add to Authorized JavaScript origins:
- https://YOUR-FRONTEND-URL.vercel.app
- https://YOUR-BACKEND-URL.vercel.app

### 6. Redeploy After Environment Variables
After adding environment variables, trigger a new deployment:
```bash
vercel --prod
```

### 7. Test Production
- [ ] Visit frontend URL
- [ ] Test Google login
- [ ] Test calendar creation
- [ ] Test booking flow
- [ ] Test all API endpoints

## 🔧 Files Created

- `vercel.json` - Root Vercel config (monorepo)
- `backend/vercel.json` - Backend deployment config
- `frontend/vercel.json` - Frontend deployment config
- `VERCEL_DEPLOYMENT.md` - Detailed deployment guide
- `DEPLOYMENT_CHECKLIST.md` - This checklist

## 🚀 Quick Deploy Commands

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy backend
cd backend && vercel --prod

# Deploy frontend
cd ../frontend && vercel --prod
```

## ⚠️ Important Notes

1. **Database Access**: Ensure your PostgreSQL database at 72.60.103.151:5433 allows connections from Vercel IPs
2. **Session Secret**: Consider generating a new strong secret for production
3. **CORS**: Make sure FRONTEND_URL matches your actual frontend domain
4. **HTTPS**: All production URLs should use HTTPS
5. **Environment Variables**: Never commit .env files to Git

## 📞 Support

If deployment fails:
1. Check Vercel deployment logs
2. Verify all environment variables are set
3. Test database connection from Vercel
4. Check Google OAuth configuration
5. Review CORS settings
