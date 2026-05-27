# MelloMinds Development Server Guide

## ✅ Current Status

Both development servers are running and ready:

### Frontend Server
- **URL:** http://localhost:5173
- **Technology:** React + Create React App (CRA)
- **Location:** `/frontend` directory
- **Command:** `npm start` (from `/frontend` directory)
- **Status:** ✅ Running

### Backend Server
- **URL:** http://localhost:3001
- **Technology:** Node.js + Express
- **Location:** `/backend` directory
- **Command:** `npm run dev` (from `/backend` directory)
- **Status:** ✅ Running
- **Health Check:** http://localhost:3001/health

---

## How to Start Development Servers

### Option 1: Start Both Servers (Recommended)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Option 2: Start Individually

**Backend Only:**
```bash
cd backend
npm run dev
```

**Frontend Only:**
```bash
cd frontend
npm start
```

---

## Important Notes

### Frontend Structure
- **Source Code:** `/frontend/src/`
- **Entry Point:** `/frontend/src/index.tsx`
- **Build Tool:** Create React App (not Vite)
- **Dev Server Port:** 5173 (default CRA port)

### Backend Structure
- **Source Code:** `/backend/`
- **Entry Point:** `/backend/server.js`
- **Build Tool:** Node.js with auto-reload via `--watch`
- **Dev Server Port:** 3001

### Environment Variables

**Backend (.env):**
- Located at: `/backend/.env`
- Contains: Database credentials, API keys, session secrets
- Required for backend to function

**Frontend (.env):**
- Located at: `/frontend/.env`
- Contains: API endpoints, feature flags
- Optional for development (defaults to localhost:3001)

---

## Accessing the Application

1. **Open Frontend:** http://localhost:5173
2. **Backend API:** http://localhost:3001
3. **Health Check:** http://localhost:3001/health

---

## Common Issues & Solutions

### Issue: Blank Page at http://localhost:5173
**Solution:** 
- Ensure you're running `npm start` from the `/frontend` directory, not the root
- Check that the frontend server is running (should see "Compiled successfully!")
- Hard refresh: Cmd+Shift+R (macOS) or Ctrl+Shift+R (Windows/Linux)

### Issue: Backend Connection Errors
**Solution:**
- Ensure backend is running on port 3001
- Check `/backend/.env` file exists and has correct database credentials
- Verify database is accessible
- Check backend logs for errors

### Issue: Port Already in Use
**Solution:**
```bash
# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9

# Kill process on port 3001 (backend)
lsof -ti:3001 | xargs kill -9
```

---

## Database

### Auto-Migrations
- All database tables are created automatically on backend startup
- No manual migrations needed
- Schema validation runs on startup

### Database Connection
- **Host:** 187.127.140.201
- **Database:** mello_db
- **User:** mello_admin
- **Connection Pool:** 20 max connections

---

## Development Workflow

1. **Start Backend:** `cd backend && npm run dev`
2. **Start Frontend:** `cd frontend && npm start`
3. **Open Browser:** http://localhost:5173
4. **Make Changes:** Edit files in `/frontend/src/` or `/backend/routes/`
5. **Auto-Reload:** Both servers auto-reload on file changes
6. **Check Logs:** Monitor terminal output for errors

---

## Useful Commands

### Backend
```bash
cd backend

# Start dev server with auto-reload
npm run dev

# Start production server
npm start

# Check database schema
node check_schema.js

# Fix database schema issues
node fix_database_schema.js
```

### Frontend
```bash
cd frontend

# Start dev server
npm start

# Build for production
npm run build

# Run tests
npm test
```

---

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user

### Bookings
- `GET /api/bookings` - Get all appointments
- `GET /api/bookings/clients` - Get unique clients
- `GET /api/bookings/stats` - Get dashboard statistics
- `POST /api/bookings` - Create appointment
- `POST /api/bookings/send-link` - Send booking link

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile
- `GET /api/users/:id` - Get user by ID

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create client
- `GET /api/clients/:id` - Get client details

### Chat
- `GET /api/chat/conversations` - Get chat conversations
- `POST /api/chat/conversations` - Create conversation
- `POST /api/chat/messages` - Send message

---

## Debugging

### Frontend Debugging
1. Open DevTools: F12 or Cmd+Option+I
2. Check Console tab for errors
3. Check Network tab for API calls
4. Use React DevTools extension for component inspection

### Backend Debugging
1. Check terminal output for logs
2. Look for error messages in console
3. Check `/backend/.env` for configuration issues
4. Use `curl` to test endpoints:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/bookings
   ```

---

## Performance Tips

- Frontend: Use React DevTools Profiler to identify slow components
- Backend: Check database query performance in logs
- Both: Monitor network requests in browser DevTools

---

## Next Steps

1. ✅ Both servers running
2. ✅ Database connected
3. ✅ Schema validated
4. 👉 Start developing!

---

**Last Updated:** May 27, 2026
**Status:** ✅ Ready for Development
