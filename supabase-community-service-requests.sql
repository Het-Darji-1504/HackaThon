-- Work Satthi shared community service requests and optional photo uploads.
-- Run once in Supabase Dashboard -> SQL Editor before using community.html.
create table if not exists public.service_requests (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 3 and 90),
 category text not null check (category in ('plumbing','electrical','cleaning','cooking','carpentry','painting')),
 description text not null check (char_length(description) between 3 and 1200),
 location_text text not null check (char_length(location_text) between 3 and 160),
 latitude double precision not null check (latitude between 6.5 and 37.5),
 longitude double precision not null check (longitude between 68 and 98.5),
 reporter_name text check (reporter_name is null or char_length(reporter_name) <= 70),
 photo_url text,
 created_at timestamptz not null default now()
);
create index if not exists service_requests_created_at_idx on public.service_requests(created_at desc);
alter table public.service_requests enable row level security;
grant select, insert on public.service_requests to anon, authenticated;
drop policy if exists "Anyone can view service requests" on public.service_requests;
create policy "Anyone can view service requests" on public.service_requests for select to anon, authenticated using (true);
drop policy if exists "Visitors can create service requests" on public.service_requests;
create policy "Visitors can create service requests" on public.service_requests for insert to anon, authenticated with check (true);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('service-request-photos','service-request-photos',true,2097152,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];
drop policy if exists "Public can view service request photos" on storage.objects;
create policy "Public can view service request photos" on storage.objects for select to anon, authenticated using (bucket_id = 'service-request-photos');
drop policy if exists "Visitors can upload service request photos" on storage.objects;
create policy "Visitors can upload service request photos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'service-request-photos');
