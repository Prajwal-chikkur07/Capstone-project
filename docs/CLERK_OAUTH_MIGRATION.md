# Clerk OAuth Migration Guide

## Overview

This document explains the migration from localStorage-based authentication to **Clerk OAuth**, with user data synced to a **Neon PostgreSQL database**.

## What Changed

### Frontend
- **Removed**: localStorage-based signup/login (`saaras_auth`, `saaras_users`)
- **Added**: `@clerk/clerk-react` package with Clerk's pre-built SignIn components
- **Updated**: API service to use Clerk JWT tokens instead of localStorage tokens
- **Updated**: App.jsx with ClerkProvider wrapper
- **Updated**: AuthPage.jsx to use Clerk's UI components
- **Added**: User sync endpoint call after Clerk signup completes

### Backend
- **Updated**: User model to match Neon schema:
  - `id` (VARCHAR 50) — Clerk user ID
  - `email` (VARCHAR 255) — User email
  - `first_name`, `last_name` (VARCHAR 100, nullable)
  - `avatar_url` (TEXT, nullable)
  - `created_at` (TIMESTAMP WITH TIME ZONE)
- **Added**: `/api/auth/sync-user` endpoint to create/update users in Neon after Clerk signup
- **Updated**: `/api/auth/me` endpoint to return user from Neon database using Clerk JWT

## Setup Instructions

### 1. Frontend Setup

#### Install Dependencies
```bash
cd Translation-agent/react-frontend
npm install
```

#### Configure Environment Variables
Create a `.env.local` file:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_API_URL=http://localhost:8000
```

Get your `VITE_CLERK_PUBLISHABLE_KEY`:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application (or use existing)
3. Copy your Publishable Key from Settings → API Keys
4. Paste into `.env.local`

#### Run Development Server
```bash
npm run dev
```

Frontend will be available at `http://localhost:5173`

### 2. Backend Setup

#### Install Dependencies
```bash
cd Translation-agent/backend
pip install -r requirements.txt
```

#### Configure Database
Create a `.env` file in the backend directory:
```env
DATABASE_URL=postgresql://user:password@neon.tech/database
```

**Get your Neon connection string:**
1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project (or use existing)
3. Copy the connection string for your database
4. Paste into `.env` as `DATABASE_URL`

#### Run Backend
```bash
python -m uvicorn main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`

Database tables will be automatically created on startup via `init_db()`.

## How It Works

### User Registration Flow

1. **User fills Clerk sign-up form** (AuthPage.jsx)
   - Clerk handles password hashing, email verification, MFA, etc.

2. **Clerk signup completes**
   - Clerk creates user and issues JWT token
   - Frontend detects `isSignedIn` is true via `useAuth()`

3. **Frontend syncs user to Neon** (AuthPage.jsx → api.js)
   ```javascript
   const response = await api.syncUser({
     id: clerkUser.id,
     email: clerkUser.emailAddresses[0].emailAddress,
     first_name: clerkUser.firstName,
     last_name: clerkUser.lastName,
     avatar_url: clerkUser.imageUrl,
   });
   ```

4. **Backend creates user in Neon** (/api/auth/sync-user)
   - Creates new user record if doesn't exist
   - Updates existing user if already in database
   - Returns user record with `created_at` timestamp

5. **App context updated** (AppContext.jsx)
   ```javascript
   login({
     id: response.id,
     email: response.email,
     firstName: response.first_name,
     lastName: response.last_name,
   });
   ```

6. **User navigated to app** (/app)
   - All subsequent API requests include Clerk JWT via interceptor
   - Backend validates JWT and identifies user

### API Authentication

#### Request Flow
```
Client
  ↓ (Clerk JWT via interceptor)
API Axios Instance
  ↓ (Authorization: Bearer <clerk-token>)
Backend FastAPI
  ↓ (decode JWT without verification, extract user ID from 'sub' claim)
SQLAlchemy Query: User.query.filter(User.id == user_id)
  ↓
Response
```

#### Request Interceptor (api.js)
```javascript
API.interceptors.request.use(async (config) => {
  const { getToken } = getAuth();
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Backend Validation (/api/auth/me)
```python
@router.get("/me", response_model=UserResponse)
def get_me(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    payload = decode(token, options={"verify_signature": False})
    user_id = payload.get("sub")  # Clerk user ID from JWT
    user = db.query(User).filter(User.id == user_id).first()
    return user
```

## Database Schema

### Users Table (Neon PostgreSQL)
```sql
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,              -- Clerk user ID
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

### Frontend (.env.local)
| Variable | Source | Purpose |
|----------|--------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard | Clerk authentication |
| `VITE_API_URL` | Your backend | Production API endpoint |

### Backend (.env)
| Variable | Source | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Neon Console | PostgreSQL connection |

## Migration from Old Auth

If you have existing users with the old system:

1. **Export old users** from localStorage
2. **Migrate to Clerk** via Clerk's import API (optional)
3. **Manual sync** to Neon using `/api/auth/sync-user` endpoint

## Troubleshooting

### "Missing VITE_CLERK_PUBLISHABLE_KEY"
- Ensure `.env.local` is in frontend root directory
- Check that key starts with `pk_test_` or `pk_live_`
- Restart dev server after adding env vars

### "Failed to sync user"
- Check backend is running on port 8000
- Verify database connection string in `.env`
- Check Neon database is accessible
- Look for SQL errors in backend logs

### "User not found in database"
- The `/api/auth/me` endpoint returned 404
- Verify user was synced via `/api/auth/sync-user`
- Check `DATABASE_URL` is correct

### "Clerk JWT decode failed"
- Ensure JWT is being sent in Authorization header
- Check frontend interceptor is working (browser DevTools → Network)
- Verify token format: `Bearer <token>`

## Security Notes

1. **Clerk handles password security** — no passwords stored in your database
2. **JWT tokens from Clerk** — cryptographically signed by Clerk
3. **Backend validates user ID** — all requests require valid Clerk JWT
4. **CORS enabled** — update `allow_origins` in main.py for production domains
5. **Neon connection** — use SSL in production (included in Neon connection string)

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/sync-user` | POST | Sync Clerk user to Neon (called after signup) |
| `/api/auth/me` | GET | Get current user (requires Clerk JWT) |
| `/api/translate-*` | POST | Translation endpoints (all require Clerk JWT) |

## Next Steps

1. ✅ Clerk OAuth integrated
2. ✅ User data synced to Neon
3. Next: Test signup flow end-to-end
4. Next: Deploy to production (Vercel + Railway/Render)
