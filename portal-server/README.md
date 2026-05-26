
# 36th Storm Corps Portal Server

This folder contains the backend scaffold for the portal upgrade.

## Features
- Google OAuth login
- Session-based auth
- Role-based access control for owner/admin/moderator/member
- Forum thread and post APIs
- Admin role management from the forum UI
- SQLite persistence
- Optional owner IP audit/lock support

## Setup
1. Copy `.env.example` to `.env`.
2. Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET`.
3. Decide who becomes owner with `OWNER_EMAIL` or `OWNER_GOOGLE_SUB`.
4. Run `npm install`.
5. Start the server with `npm start`.
6. Open `http://localhost:3000/forum.html` for the forum UI or `http://localhost:3000/admin-console.html` for the admin console.
7. In the Google OAuth consent screen, add your own Google account under Test Users so the login works while the app is still in testing.

## Notes
- IP binding is supported as an optional lock via `OWNER_IP_LOCK=true`, but it should be treated as an additional restriction, not the only identity factor.
- For local development, the callback URL should point to `http://localhost:3000/auth/google/callback` unless you run the app behind a tunnel with HTTPS.
- The backend also exposes `/api/users` and `/api/forum/*` for future React, Vue, or plain JS frontends.
