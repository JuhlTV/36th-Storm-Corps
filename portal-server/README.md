
# 36th Storm Corps Portal Server

This folder contains the backend scaffold for the portal upgrade.

## Features
- Local username/password login (no domain required)
- Optional Google OAuth login
- Encrypted account store file for local credentials (`data/auth.enc.json`)
- Session-based auth
- Role-based access control for owner/admin/moderator/member
- Forum thread and post APIs
- Admin role management from the forum UI
- SQLite persistence
- Optional owner IP audit/lock support

## Setup
1. Copy `.env.example` to `.env`.
2. Set `SESSION_SECRET`.
3. Set `AUTH_ENCRYPTION_KEY` (long random key).
4. Set owner via `OWNER_USERNAME` (recommended) or `OWNER_EMAIL`.
5. Run `npm install`.
6. Start the server with `npm start`.
7. Open `http://localhost:3000/forum.html` for the forum UI or `http://localhost:3000/admin-console.html` for the admin console.
8. Register your first user in the forum login section.

## Local login flow
- Register with username/password directly in `forum.html`.
- Login with username or email plus password.
- Passwords are stored as hashes (`bcryptjs`), never plain text.
- Local account data is saved encrypted at rest in `portal-server/data/auth.enc.json` (AES-256-GCM).

## Notes
- IP binding is supported as an optional lock via `OWNER_IP_LOCK=true`, but it should be treated as an additional restriction, not the only identity factor.
- If `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, Google OAuth routes remain available as optional fallback.
- The backend also exposes `/api/users` and `/api/forum/*` for future React, Vue, or plain JS frontends.
