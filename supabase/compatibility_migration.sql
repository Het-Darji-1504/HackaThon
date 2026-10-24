-- Work Satthi: compatibility migration for the existing website flows.
-- Run once in Supabase SQL Editor after supabase/schema.sql.
-- Safe to re-run: the table and policies are guarded.

-- The current booking form allows customers to request a service before
-- selecting a specific professional. Keep worker assignment optional.
alter table public.bookings
  alter column worker_id drop not null;

-- Store contact form submissions in Supabase instead of the old SQLite table.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 160),
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "contact_messages_public_submit" on public.contact_messages;
create policy "contact_messages_public_submit"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (
    char_length(trim(name)) between 1 and 80
    and char_length(trim(email)) between 3 and 160
    and char_length(trim(subject)) between 1 and 120
    and char_length(trim(message)) between 1 and 2000
  );

-- Do not create public SELECT, UPDATE, or DELETE policies for contact messages.
-- Only trusted project administrators should read these submissions.
