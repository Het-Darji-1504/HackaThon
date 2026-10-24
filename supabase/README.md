# Supabase setup for Work Satthi

This folder contains the proposed PostgreSQL schema for the Work Satthi marketplace.

## Create the tables

1. Open the Supabase project dashboard.
2. Go to **SQL Editor** and create a new query.
3. Copy the contents of [schema.sql](./schema.sql), review it, and run it on a fresh project.
4. Check **Table Editor** and confirm the tables were created.

The schema uses Supabase Auth (`auth.users`) for account identity. It does not store passwords in application tables.

## Important: the app is not connected yet

The current repository still has an Express API backed by SQLite and its own JWT login. Creating the tables in Supabase does not automatically move that existing API or the frontend to Supabase. The next implementation step is to migrate authentication and API operations together, then update the frontend pages to use those endpoints. Do not run both authentication systems in production without a deliberate migration plan.

## Security

- Never commit `.env`, database passwords, service-role keys, or secret keys.
- A Supabase publishable key (or legacy `anon` key) may be used in browser code, but only with appropriate Row Level Security policies.
- A `service_role` / secret key must remain server-side and must never use a `NEXT_PUBLIC_` or other browser-exposed variable.
- Review policies and test as anonymous, customer, and worker accounts before production use.
- The starter schema is a foundation; role escalation, booking-status transitions, moderation, and message/report abuse controls need server-side validation before a public launch.
