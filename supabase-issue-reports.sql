-- Work Satthi civic issue reports
-- Run once in Supabase Dashboard -> SQL Editor.
-- This is intentionally separate from the existing schema so it does not recreate existing types/tables.
create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  issue_type text not null check (issue_type in ('plumbing','electrical','cleaning','cooking','carpentry','painting')),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 3 and 1200),
  location_text text not null check (char_length(location_text) between 3 and 240),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  status text not null default 'reported' check (status in ('reported','acknowledged','in_progress','resolved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists issue_reports_created_at_idx on public.issue_reports (created_at desc);
create index if not exists issue_reports_location_idx on public.issue_reports (latitude, longitude);
alter table public.issue_reports enable row level security;
grant select, insert on public.issue_reports to authenticated;
drop policy if exists "Signed-in users can view map issue reports" on public.issue_reports;
create policy "Signed-in users can view map issue reports"
  on public.issue_reports for select to authenticated using (true);
drop policy if exists "Users can submit their own issue reports" on public.issue_reports;
create policy "Users can submit their own issue reports"
  on public.issue_reports for insert to authenticated with check ((select auth.uid()) = reporter_id);
-- Reporters may edit only their own text/status only if a later workflow adds an update form.
-- No update/delete policies are granted by this setup, preventing arbitrary report tampering.
