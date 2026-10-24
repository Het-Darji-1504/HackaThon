-- Work Satthi service categories for the issue map
-- Run this AFTER the original supabase-issue-reports.sql if that table already exists.
-- Keep existing rows while converting older civic categories to the closest available service category.
alter table public.issue_reports drop constraint if exists issue_reports_issue_type_check;
update public.issue_reports set issue_type = case
  when issue_type = 'water_leak' then 'plumbing'
  when issue_type in ('electrical_hazard','streetlight') then 'electrical'
  when issue_type in ('garbage','drainage') then 'cleaning'
  when issue_type = 'road_damage' then 'carpentry'
  when issue_type = 'other' then 'cleaning'
  else issue_type
end
where issue_type not in ('plumbing','electrical','cleaning','cooking','carpentry','painting');
alter table public.issue_reports
  add constraint issue_reports_issue_type_check
  check (issue_type in ('plumbing','electrical','cleaning','cooking','carpentry','painting'));
