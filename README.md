# Work Satthi

**Local skills. Trusted hands. Stronger communities.** A hyperlocal services marketplace connecting customers with local professionals.

## Project structure
- `index.html`, `services.html`, `login.html`, `profile.html`, `dashboard.html`, `about.html`, `404.html`: static pages.
- `style.css`: shared site styling; `script.js`, `services.js`, `login.js`, `dashboard.js`, `worker-registration.js`: page behavior.
- `assets/illustrations/` and `assets/services/`: vector artwork and service-card images.
- `api.js`: the one public frontend API URL setting; never place secrets here.
- `backend/`: Express API, SQLite database setup, tests, and backend instructions.
- `scripts/check-site.js`: checks styling rules and local page references.

## Features
Customer and worker registration/login, worker profiles and search, profile editing, booking requests and customer booking history/cancellation, service catalogue, and contact messages. Passwords are bcrypt-hashed. Public worker search omits email and phone. Worker profile experience and availability are saved. Booking requests remain pending until availability is confirmed.

**Online payments are not implemented in the current version.** There is no checkout, payment gateway, or payment API.

## Local development
Requires Node.js 20+. From the repository root:
```sh
cd backend
npm install
```
Copy `backend/.env.example` to `backend/.env`, set a private random `JWT_SECRET` (32+ characters), then run `npm run dev`. Do not commit `.env`. Serve the repository root with a local static server. `api.js` defaults to an empty URL; set `window.WORK_SATTHI_API_URL` to `http://localhost:3000` in that file for local API use. Set `CORS_ORIGINS` to the exact origin serving the frontend.

## Checks
From `backend/`, run `npm run lint`, `npm test`, and `npm run check:site`. Tests use a temporary SQLite database and do not contact production services.

## Deployment status
The existing GitHub Actions workflow publishes the static site to GitHub Pages after CI passes on `main`. No backend deployment URL is configured and no backend hosting is provisioned. To connect a self-hosted backend, configure `JWT_SECRET`, an exact `CORS_ORIGINS` allow-list, and a persistent `DATABASE_PATH`, then set the API origin in `api.js` and verify `/api/health` and `/api/services`. Hosting and storage costs depend on the provider; this project does not create a service or select paid resources.

Back up the SQLite database regularly and verify restores before relying on it. Keep the database directory on persistent storage in any deployed environment; ephemeral disks can lose data on restart or redeploy.

## Security and remaining work
JWTs currently live in browser `localStorage`, which makes them readable by JavaScript and vulnerable if the page has an XSS flaw. The API uses seven-day bearer tokens; logout clears the browser token but cannot revoke a copied token. For a production service, migrate to secure, HttpOnly, SameSite cookies with CSRF protection and a deployment architecture that supports them. Email verification, password recovery, identity verification, moderation, notifications, data retention, backups/restore drills, monitoring, and independent security review are not implemented.


## Community Watch India (prototype)

A civic issue-reporting experience is available at `community.html`. It includes an interactive India map, category-specific map markers, browser geolocation (only after a user action), a report form, map filters, and recent-report cards.

**Important current limitation:** this page is a frontend prototype. Reports are stored in the current browser's `localStorage`, so they do not sync across devices, are not submitted to public authorities, and can be cleared by the browser. The optional photo field is not uploaded. Do not treat the prototype as an official reporting or emergency service.

The map uses Leaflet and OpenStreetMap tiles. A production release still needs a deployed API with persistent report storage, image-upload rules, abuse/spam moderation, privacy/retention policy, and appropriate access controls. No backend endpoint is configured for community reports yet.
