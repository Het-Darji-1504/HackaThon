# Work Satthi API

Express API with SQLite persistence. Requires Node.js 20+. From this directory, install dependencies with `npm install`. Copy `.env.example` to `.env`, set a private `JWT_SECRET` of at least 32 characters, and run `npm run dev`. The API listens on port 3000 by default. `DATABASE_PATH` defaults to `./data/work-satthi.db`; its parent directory is created automatically.

## Configuration
- `PORT`: optional HTTP port (default `3000`).
- `JWT_SECRET`: required, private random value of at least 32 characters. Never commit it.
- `DATABASE_PATH`: optional SQLite file path. Use persistent storage for any deployment.
- `CORS_ORIGINS`: optional comma-separated exact origins; defaults to the repository's Pages origin and localhost development origins. Set the exact frontend origin in hosted environments.

No backend URL is configured in the repository. Hosting is optional and must be provisioned separately; choose a provider and storage plan with its costs understood. GitHub Pages only hosts the static frontend. After deploying an API, set its public origin in the root `api.js`, then verify `GET /api/health` and `GET /api/services`. No cloud service is created by this project.

## Routes
- `GET /api/health`, `GET /api/services`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `PUT /api/users/me`
- `GET /api/workers?q=plumb&area=Ahmedabad` (public results omit email and phone)
- `POST /api/bookings`, `GET /api/bookings/mine`, `DELETE /api/bookings/:id`
- `POST /api/contact`

Only customers can create, list, or cancel customer booking requests. A booking stays pending until availability is confirmed. Worker experience and availability fields are persisted. Online payments are not implemented in the current version.

Run `npm run lint`, `npm test`, and `npm run check:site` from this directory. API tests use an isolated temporary database. Back up the SQLite database and test restores before relying on hosted data. JWTs are returned as bearer tokens and stored by the frontend in `localStorage`; this carries XSS exposure and logout cannot revoke copied tokens. Secure HttpOnly sessions and CSRF protection remain recommended for production. Email verification, recovery, identity verification, moderation, notifications, monitoring, and data-retention workflows remain future work.
