-- Work Satthi: Supabase Auth/profile integration and role hardening.
-- Run in Supabase Dashboard -> SQL Editor after schema.sql and compatibility_migration.sql.
-- Safe to re-run.

-- Users may not assign themselves admin during direct profile inserts.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id and role in ('customer', 'worker'));

-- Prevent users from changing their own role after profile creation.
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed by the account owner.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
before update of role on public.profiles
for each row execute function public.prevent_profile_role_change();

-- Create profile rows from Supabase Auth metadata. The role is explicitly
-- allow-listed; user-editable metadata can never create an admin profile.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.account_role;
  full_name_value text;
  phone_value text;
  area_value text;
  service_slug text;
  service_uuid uuid;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
  safe_role := case when requested_role = 'worker'
    then 'worker'::public.account_role
    else 'customer'::public.account_role
  end;

  full_name_value := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Work Satthi user'
  );
  phone_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  area_value := nullif(trim(coalesce(new.raw_user_meta_data ->> 'area', '')), '');
  service_slug := nullif(trim(coalesce(new.raw_user_meta_data ->> 'service', '')), '');

  insert into public.profiles (id, full_name, phone, role, area)
  values (new.id, full_name_value, phone_value, safe_role, area_value)
  on conflict (id) do nothing;

  if safe_role = 'worker' then
    select s.id into service_uuid
    from public.services s
    where s.slug = service_slug and s.is_active = true
    limit 1;

    insert into public.worker_profiles (user_id, service_id, service_area, is_listed)
    values (new.id, service_uuid, area_value, true)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Trigger functions need no direct API access; only the Auth trigger invokes it.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- This function is only used by a table trigger, never by clients.
revoke all on function public.prevent_profile_role_change() from public, anon, authenticated;
