-- Work Satthi / Supabase PostgreSQL schema
-- Run this in Supabase Dashboard -> SQL Editor after reviewing it.
-- Authentication is managed by Supabase Auth. Never store passwords in public tables.

create extension if not exists pgcrypto;

create type public.account_role as enum ('customer', 'worker', 'admin');
create type public.booking_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'completed');
create type public.verification_status as enum ('not_submitted', 'pending', 'verified', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role public.account_role not null default 'customer',
  avatar_url text,
  city text,
  area text,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 25)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null default '',
  illustration_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.worker_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text,
  bio text not null default '',
  experience_years integer not null default 0 check (experience_years >= 0),
  service_id uuid references public.services(id) on delete set null,
  custom_service text,
  service_area text,
  city text,
  hourly_rate numeric(10,2) check (hourly_rate is null or hourly_rate >= 0),
  currency text not null default 'INR',
  availability_summary text,
  verification public.verification_status not null default 'not_submitted',
  is_listed boolean not null default true,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_location_pair check (
    (latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table public.worker_availability (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.worker_profiles(user_id) on delete cascade,
  weekday smallint check (weekday between 0 and 6),
  available_from time,
  available_until time,
  specific_date date,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_has_day check (weekday is not null or specific_date is not null),
  constraint availability_time_order check (
    available_from is null or available_until is null or available_from < available_until
  )
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(user_id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  description text not null default '',
  preferred_at timestamptz,
  address text not null,
  city text not null,
  area text,
  contact_phone text,
  status public.booking_status not null default 'pending',
  customer_notes text,
  worker_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_not_self check (customer_id <> worker_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  worker_id uuid not null references public.worker_profiles(user_id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  worker_id uuid not null references public.worker_profiles(user_id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (customer_id, worker_id, booking_id),
  constraint conversation_not_self check (customer_id <> worker_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  kind text not null default 'general',
  related_booking_id uuid references public.bookings(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index worker_profiles_search_idx on public.worker_profiles (city, service_area, service_id) where is_listed = true;
create index bookings_customer_created_idx on public.bookings (customer_id, created_at desc);
create index bookings_worker_created_idx on public.bookings (worker_id, created_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- Enable Row Level Security on every exposed application table.
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.worker_availability enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users can read/update only their own profile; worker public details live separately.
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Active services are public catalogue data.
create policy "services_read_active" on public.services for select to anon, authenticated using (is_active = true);

-- Worker cards are public, but only the owner may create/update their own worker record.
create policy "worker_profiles_read_listed" on public.worker_profiles for select to anon, authenticated using (is_listed = true or (select auth.uid()) = user_id);
create policy "worker_profiles_insert_own" on public.worker_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "worker_profiles_update_own" on public.worker_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "worker_profiles_delete_own" on public.worker_profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "availability_read_listed" on public.worker_availability for select to anon, authenticated using (
  exists (select 1 from public.worker_profiles w where w.user_id = worker_id and (w.is_listed = true or w.user_id = (select auth.uid())))
);
create policy "availability_manage_own" on public.worker_availability for all to authenticated using ((select auth.uid()) = worker_id) with check ((select auth.uid()) = worker_id);

-- Customers and assigned workers can see bookings. Only customers create their own requests.
create policy "bookings_read_participants" on public.bookings for select to authenticated using (
  (select auth.uid()) = customer_id or (select auth.uid()) = worker_id
);
create policy "bookings_create_customer" on public.bookings for insert to authenticated with check ((select auth.uid()) = customer_id);
create policy "bookings_update_participants" on public.bookings for update to authenticated
using ((select auth.uid()) = customer_id or (select auth.uid()) = worker_id)
with check ((select auth.uid()) = customer_id or (select auth.uid()) = worker_id);

create policy "reviews_read_all" on public.reviews for select to anon, authenticated using (true);
create policy "reviews_create_customer" on public.reviews for insert to authenticated with check (
  (select auth.uid()) = customer_id and exists (
    select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()) and b.worker_id = worker_id and b.status = 'completed'
  )
);

create policy "conversations_read_participants" on public.conversations for select to authenticated using (
  (select auth.uid()) = customer_id or (select auth.uid()) = worker_id
);
create policy "conversations_create_customer" on public.conversations for insert to authenticated with check ((select auth.uid()) = customer_id);

create policy "messages_read_participants" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.worker_id))
);
create policy "messages_send_as_participant" on public.messages for insert to authenticated with check (
  (select auth.uid()) = sender_id and exists (
    select 1 from public.conversations c where c.id = conversation_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.worker_id)
  )
);
create policy "messages_mark_read_participant" on public.messages for update to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.worker_id))
) with check (
  exists (select 1 from public.conversations c where c.id = conversation_id and ((select auth.uid()) = c.customer_id or (select auth.uid()) = c.worker_id))
);

create policy "notifications_read_own" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger worker_profiles_set_updated_at before update on public.worker_profiles for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.set_updated_at();

-- Initial catalogue: safe to run once on a fresh project.
insert into public.services (slug, name, category, description) values
  ('plumbing', 'Plumbing', 'repairs', 'Leaks, taps, fittings, and common water-related repairs.'),
  ('electrical', 'Electrical Work', 'home', 'Household electrical repairs and installation by skilled workers.'),
  ('cleaning', 'Home Cleaning', 'cleaning', 'One-time cleaning or scheduled help to keep spaces fresh.'),
  ('cooking', 'Cooking & Daily Help', 'daily-help', 'Local cooks and people with everyday skills.'),
  ('carpentry', 'Carpentry', 'repairs', 'Furniture repairs, fittings, and small woodwork jobs.'),
  ('painting', 'Painting', 'home', 'Room painting, touch-up work, and surface preparation.')
on conflict (slug) do nothing;
