# MelloMinds Application

A comprehensive mental health and wellness platform for therapists and clients.

## Quick Start

### Prerequisites
- Node.js (v16+)
- PostgreSQL
- npm or yarn

### Installation

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Environment Setup

1. Copy `.env.example` to `.env` in both `backend/` and `frontend/` directories
2. Configure your database connection and API keys

### Running the Application

```bash
# Terminal 1: Start backend server
cd backend
npm run dev

# Terminal 2: Start frontend server
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Project Structure

```
├── backend/          # Express.js server
├── frontend/         # React + TypeScript application
├── database/         # Database schemas and migrations
├── docs/            # Documentation
└── public/          # Static assets
```

## Documentation

For detailed documentation, see the [docs/](./docs/) folder:
- [Project README](./docs/PROJECT_README.md)
- [Google OAuth Setup](./docs/GOOGLE_OAUTH_SETUP.md)
- [Steering Guide](./docs/steering.md)

## Features

- User authentication (Email & Google OAuth)
- Therapist profile management
- Client booking system
- Calendar integration
- Session notes and documentation
- Secure messaging
- Payment integration
- Role-based access control (RBAC)
- AI-powered chatbot assistant

## Support

For issues or questions, please refer to the documentation in the `docs/` folder.
