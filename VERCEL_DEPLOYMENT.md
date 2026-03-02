# Vercel Deployment Guide

## Prerequisites
- Vercel account (sign up at vercel.com)
- Vercel CLI installed: `npm i -g vercel`

## Environment Variables for Vercel

### Backend Environment Variables
Add these in Vercel Dashboard → Project → Settings → Environment Variables:

```
DB_HOST=72.60.103.151
DB_PORT=5433
DB_NAME=mello_db
DB_USER=postgres
DB_PASSWORD=aikimkc

GOOGLE_CLIENT_ID=636627792203-7bc9oo51ub34qpff75v57hf9pa2dp3j2.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_CALLBACK_URL=https://app-mellominds-co-in.vercel.app/auth/google/callback

SESSION_SECRET=mellominds_secret_key_change_this_in_production_2024

FRONTEND_URL=https://app-mellominds-co-in.vercel.app

PORT=3000

AWS_REGION=us-east-1
DYNAMODB_TABLE=saas-app-data
```

### Frontend Environment Variables
```
REACT_APP_API_URL=https://your-backend-url.vercel.app
```

## Deployment Steps

### Option 1: Deploy via Vercel CLI

#### Deploy Backend:
```bash
cd backend
vercel --prod
```

#### Deploy Frontend:
```bash
cd frontend
vercel --prod
```

### Option 2: Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset**: Other (for backend) / Create React App (for frontend)
   - **Root Directory**: `backend` or `frontend`
   - **Build Command**: 
     - Backend: (leave empty)
     - Frontend: `npm run build`
   - **Output Directory**: 
     - Backend: (leave empty)
     - Frontend: `build`
5. Add environment variables
6. Click "Deploy"

### Option 3: Separate Deployments (Recommended)

Deploy backend and frontend as separate projects:

#### Backend Deployment:
```bash
cd backend
vercel --prod
# Note the deployment URL (e.g., https://backend-xyz.vercel.app)
```

#### Frontend Deployment:
```bash
cd frontend
# Update REACT_APP_API_URL in Vercel dashboard to backend URL
vercel --prod
```

## Post-Deployment Steps

### 1. Update Google OAuth URLs
Go to Google Cloud Console and update:
- **Authorized redirect URIs**:
  - `https://your-backend-url.vercel.app/auth/google/callback`
  - `https://your-backend-url.vercel.app/api/connect-calendar/callback`
- **Authorized JavaScript origins**:
  - `https://your-frontend-url.vercel.app`
  - `https://your-backend-url.vercel.app`

### 2. Update Environment Variables
In Vercel Dashboard:
- Backend: Set `FRONTEND_URL` to your frontend Vercel URL
- Frontend: Set `REACT_APP_API_URL` to your backend Vercel URL
- Backend: Set `GOOGLE_CALLBACK_URL` to your backend Vercel URL + `/auth/google/callback`

### 3. Test the Deployment
1. Visit your frontend URL
2. Try Google login
3. Test calendar integration
4. Check all API endpoints

## Database Configuration

Your PostgreSQL database is already configured at:
- Host: 72.60.103.151:5433
- Database: mello_db

Make sure this database is accessible from Vercel's servers (check firewall rules).

## Troubleshooting

### CORS Errors
Make sure `FRONTEND_URL` in backend matches your actual frontend URL.

### OAuth Errors
Verify Google Cloud Console has the correct production URLs.

### Database Connection Issues
Check if your database allows connections from Vercel IPs.

### Session Issues
Make sure `SESSION_SECRET` is set and cookies are configured for production.

## Custom Domain (Optional)

If you want to use `app.mellominds.co.in`:
1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update all environment variables with new domain
5. Update Google OAuth URLs with new domain

## Security Notes

- Never commit `.env` files to Git
- Use strong `SESSION_SECRET` in production
- Enable HTTPS only cookies in production
- Consider using Vercel's environment variable encryption
- Rotate credentials regularly

## Monitoring

- Check Vercel Dashboard for deployment logs
- Monitor database connections
- Set up error tracking (Sentry, LogRocket, etc.)
