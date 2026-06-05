-- =====================================================================
-- AVDP Dashboard — one-shot backend bootstrap
-- Run this entire file once in the target project's Supabase SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- It creates the schema, RLS, scheduled reports, seed data and 3 demo users.
-- After running: deploy the edge function in supabase/functions/advisor and set
-- the GEMINI_API_KEY function secret. Then point the app env at this project.
-- =====================================================================


-- ===== 0001 core schema =====
-- AVDP Dashboard core schema
-- Profiles, indicators (+ generated progress/status), history, alerts, surveys,
-- survey responses, and audit logs. Progress & Status are GENERATED columns so
-- they can never drift out of sync with baseline/achieved.

create extension if not exists pgcrypto;

-- =========================================================
-- Profiles (1:1 with auth.users) holding role + district
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'Public'
    check (role in ('Admin','Officer','Stakeholder','Public')),
  district text,
  created_at timestamptz not null default now()
);

-- RBAC helper functions (SECURITY DEFINER avoids RLS recursion)
create or replace function public.auth_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_district() returns text
  language sql stable security definer set search_path = public as $$
  select district from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_email() returns text
  language sql stable security definer set search_path = public as $$
  select email from public.profiles where id = auth.uid();
$$;

-- Auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role, district)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'Public'),
    new.raw_user_meta_data->>'district'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Indicators (progress + status are generated => always consistent)
-- =========================================================
create table public.indicators (
  id text primary key,
  name text not null,
  baseline numeric not null default 0,
  achieved numeric not null default 0,
  target numeric,                         -- logframe end-of-project target
  district text not null,
  commodity text not null default 'General',
  progress numeric generated always as (
    round((case when baseline > 0 then achieved::numeric / baseline * 100 else 100 end)::numeric, 1)
  ) stored,
  status text generated always as (
    case
      when (case when baseline > 0 then achieved::numeric / baseline * 100 else 100 end) < 100 then 'Critical'
      when (case when baseline > 0 then achieved::numeric / baseline * 100 else 100 end) < 130 then 'Need Attention'
      else 'On Track'
    end
  ) stored,
  last_updated timestamptz not null default now()
);

-- Time-series history of every indicator change
create table public.indicator_history (
  id bigint generated always as identity primary key,
  indicator_id text not null references public.indicators(id) on delete cascade,
  baseline numeric not null,
  achieved numeric not null,
  progress numeric not null,
  status text not null,
  changed_by text not null default 'system',
  recorded_at timestamptz not null default now()
);
create index idx_indicator_history_indicator on public.indicator_history(indicator_id, recorded_at);

create or replace function public.record_indicator_history() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.indicator_history(indicator_id, baseline, achieved, progress, status, changed_by)
  values (new.id, new.baseline, new.achieved, new.progress, new.status,
          coalesce((select email from public.profiles where id = auth.uid()), 'system'));
  return new;
end; $$;

create trigger trg_indicator_history
  after insert or update of baseline, achieved on public.indicators
  for each row execute function public.record_indicator_history();

-- keep last_updated fresh on writes
create or replace function public.touch_last_updated() returns trigger
  language plpgsql set search_path = public as $$
begin new.last_updated = now(); return new; end; $$;
create trigger trg_touch_indicators before update on public.indicators
  for each row execute function public.touch_last_updated();

-- =========================================================
-- Alerts (with enable/pause flag for CRUD management)
-- =========================================================
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  indicator_id text references public.indicators(id) on delete cascade,
  indicator_name text not null default '',
  district text not null default '',
  threshold_value numeric not null,
  current_value numeric not null default 0,
  condition text not null default 'below' check (condition in ('below','above')),
  recipient_email text not null,
  status text not null default 'Pending' check (status in ('Sent','Pending','Failed')),
  enabled boolean not null default true,
  triggered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- =========================================================
-- Surveys + responses (with gender / youth disaggregation)
-- =========================================================
create table public.surveys (
  id text primary key,
  title text not null,
  description text not null default '',
  type text not null,
  status text not null default 'Scheduled' check (status in ('Active','Completed','Scheduled')),
  district text not null,
  respondents_count int not null default 0,
  target_count int not null default 100,
  focal_commodity text not null default 'General',
  last_conducted timestamptz not null default now(),
  indicators_affected text[] not null default '{}',
  key_findings text
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id text not null references public.surveys(id) on delete cascade,
  respondent_name text not null,
  respondent_type text not null,
  district text not null,
  commodity text not null default 'General',
  gender text check (gender in ('Female','Male','Other')),
  age_group text check (age_group in ('Youth (18-35)','Adult (36-59)','Senior (60+)')),
  answers jsonb not null default '[]',
  submitted_at timestamptz not null default now()
);
create index idx_survey_responses_survey on public.survey_responses(survey_id);

-- =========================================================
-- Activity / audit log
-- =========================================================
create table public.activity_logs (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  user_email text not null default 'system',
  role text not null default 'System',
  action text not null
);
create index idx_activity_logs_ts on public.activity_logs(ts desc);

-- ===== 0002 RLS policies =====
-- Row Level Security policies. Public (anon) gets read-only access to the
-- dashboard data; writes are gated by role/district via the RBAC helpers.

alter table public.profiles          enable row level security;
alter table public.indicators        enable row level security;
alter table public.indicator_history enable row level security;
alter table public.alerts            enable row level security;
alter table public.surveys           enable row level security;
alter table public.survey_responses  enable row level security;
alter table public.activity_logs     enable row level security;

-- ---------- profiles ----------
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.auth_role() = 'Admin');
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));
create policy profiles_admin_all on public.profiles
  for all using (public.auth_role() = 'Admin') with check (public.auth_role() = 'Admin');

-- ---------- indicators (public read; write gated by role/district) ----------
create policy indicators_public_read on public.indicators
  for select to anon, authenticated using (true);
create policy indicators_admin_write on public.indicators
  for all to authenticated
  using (public.auth_role() = 'Admin')
  with check (public.auth_role() = 'Admin');
create policy indicators_officer_update on public.indicators
  for update to authenticated
  using (
    public.auth_role() = 'Officer'
    and (public.auth_district() is null or public.auth_district() = district)
  )
  with check (
    public.auth_role() = 'Officer'
    and (public.auth_district() is null or public.auth_district() = district)
  );

-- ---------- indicator_history (public read; inserts via SECURITY DEFINER trigger) ----------
create policy history_public_read on public.indicator_history
  for select to anon, authenticated using (true);

-- ---------- surveys (public read; admin manage) ----------
create policy surveys_public_read on public.surveys
  for select to anon, authenticated using (true);
create policy surveys_admin_write on public.surveys
  for all to authenticated
  using (public.auth_role() = 'Admin') with check (public.auth_role() = 'Admin');

-- ---------- survey_responses (public read; authenticated submit) ----------
create policy responses_public_read on public.survey_responses
  for select to anon, authenticated using (true);
create policy responses_auth_insert on public.survey_responses
  for insert to authenticated with check (auth.uid() is not null);

-- ---------- alerts (public read; signed-in non-Public roles manage) ----------
create policy alerts_public_read on public.alerts
  for select to anon, authenticated using (true);
create policy alerts_manage on public.alerts
  for all to authenticated
  using (public.auth_role() in ('Admin','Officer','Stakeholder'))
  with check (public.auth_role() in ('Admin','Officer','Stakeholder'));

-- ---------- activity_logs (public read; authenticated insert) ----------
create policy logs_public_read on public.activity_logs
  for select to anon, authenticated using (true);
create policy logs_auth_insert on public.activity_logs
  for insert to authenticated with check (auth.uid() is not null);

-- ===== 0003 security hardening =====
-- Security hardening based on Supabase advisors:
-- lock internal SECURITY DEFINER functions away from the REST API surface.
-- (Trigger functions still fire as definer regardless of these grants;
--  the RBAC helpers remain executable by authenticated users for RLS.)

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.record_indicator_history() from public, anon, authenticated;
revoke all on function public.touch_last_updated() from public, anon, authenticated;

revoke all on function public.auth_role() from public, anon;
revoke all on function public.auth_district() from public, anon;
revoke all on function public.auth_email() from public, anon;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_district() to authenticated;
grant execute on function public.auth_email() to authenticated;

-- ===== 0004 scheduled reports =====
-- Generated M&E digests (scheduled daily via pg_cron + on-demand by admins).
-- Self-contained: no external email provider required.

create table public.reports (
  id bigint generated always as identity primary key,
  generated_at timestamptz not null default now(),
  title text not null,
  summary jsonb not null,
  markdown text not null
);
alter table public.reports enable row level security;
create policy reports_public_read on public.reports
  for select to anon, authenticated using (true);

create or replace function public.generate_me_digest() returns bigint
  language plpgsql security definer set search_path = public as $$
declare
  total int; critical int; need int; ontrack int; avgp numeric;
  tgt_total int; tgt_met int; regions jsonb; md text; rid bigint;
begin
  select count(*),
         count(*) filter (where status='Critical'),
         count(*) filter (where status='Need Attention'),
         count(*) filter (where status='On Track'),
         coalesce(round(avg(progress),1),0)
    into total, critical, need, ontrack, avgp
  from public.indicators;

  select count(*) filter (where target is not null and target>0),
         count(*) filter (where target is not null and target>0 and achieved>=target)
    into tgt_total, tgt_met
  from public.indicators;

  select jsonb_agg(jsonb_build_object('district',district,'avg_progress',ap,'critical',cr) order by cr desc, ap asc)
    into regions
  from (
    select district, round(avg(progress),1) ap, count(*) filter (where status='Critical') cr
    from public.indicators group by district
  ) s;

  md := format(
    E'# AVDP National M&E Digest\n\nGenerated: %s\n\n## Headline\n- Total indicators: %s\n- On track: %s | Need attention: %s | Critical: %s\n- Average progress: %s%%\n- Logframe targets met: %s of %s\n\nGenerated automatically by the AVDP monitoring platform.',
    to_char(now(),'YYYY-MM-DD HH24:MI'), total, ontrack, need, critical, avgp, tgt_met, tgt_total
  );

  insert into public.reports(title, summary, markdown)
  values (
    format('National M&E Digest — %s', to_char(now(),'YYYY-MM-DD')),
    jsonb_build_object(
      'total',total,'critical',critical,'need_attention',need,'on_track',ontrack,
      'avg_progress',avgp,'targets_met',tgt_met,'targets_total',tgt_total,'regions',regions
    ),
    md
  )
  returning id into rid;
  return rid;
end$$;

create or replace function public.generate_report_admin() returns bigint
  language plpgsql security definer set search_path = public as $$
begin
  if public.auth_role() <> 'Admin' then
    raise exception 'Only admins may generate reports';
  end if;
  return public.generate_me_digest();
end$$;

revoke all on function public.generate_me_digest() from public, anon, authenticated;
revoke all on function public.generate_report_admin() from public, anon;
grant execute on function public.generate_report_admin() to authenticated;

create extension if not exists pg_cron;
select cron.schedule('avdp-daily-digest', '0 6 * * *', $$select public.generate_me_digest()$$);


-- ============================================================
-- SEED DATA
-- ============================================================
insert into public.indicators (id,name,baseline,achieved,district,commodity,last_updated) values
('LGF-001','Yield Increase',40,34,'Kailahun','Cocoa','2026-06-03T10:00:00.000Z'),
('LGF-002','Yield Increase',43,54,'Kenema','Vegetables','2026-06-02T10:06:00.000Z'),
('LGF-003','Gender Inclusion',11,38,'Kono','General','2026-06-01T10:12:00.000Z'),
('LGF-004','Farmer Income',57,62,'Bo','General','2026-05-31T10:18:00.000Z'),
('LGF-005','Road Rehab',23,47,'Bonthe','General','2026-05-30T10:24:00.000Z'),
('LGF-006','Road Rehab',51,88,'Moyamba','General','2026-06-03T10:30:00.000Z'),
('LGF-007','Seedling Survival Rate',17,56,'Pujehun','Oil Palm','2026-06-02T10:36:00.000Z'),
('LGF-008','Processing Facilities Built',14,32,'Port Loko','General','2026-06-01T10:42:00.000Z'),
('LGF-009','Yield Increase',40,70,'Kambia','Rice','2026-05-31T10:48:00.000Z'),
('LGF-010','Seedling Survival Rate',33,63,'Bombali','Rice','2026-05-30T10:54:00.000Z'),
('LGF-011','Gender Inclusion',13,48,'Tonkolili','General','2026-06-03T11:00:00.000Z'),
('LGF-012','Farmer Income',26,47,'Koinadugu','General','2026-06-02T11:06:00.000Z'),
('LGF-013','Farmer Income',39,45,'Falaba','General','2026-06-01T11:12:00.000Z'),
('LGF-014','Road Rehab',30,61,'Karene','General','2026-05-31T11:18:00.000Z'),
('LGF-015','Road Rehab',10,42,'Western Area Rural','General','2026-05-30T11:24:00.000Z'),
('LGF-016','Market Access Improvement',13,53,'Western Area Urban','General','2026-06-03T11:30:00.000Z'),
('LGF-017','Road Rehab',35,49,'Kailahun','General','2026-06-02T11:36:00.000Z'),
('LGF-018','Processing Facilities Built',20,17,'Kenema','Vegetables','2026-06-01T11:42:00.000Z'),
('LGF-019','Road Rehab',44,50,'Kono','General','2026-05-31T11:48:00.000Z'),
('LGF-020','Gender Inclusion',28,52,'Bo','General','2026-05-30T11:54:00.000Z'),
('LGF-021','Processing Facilities Built',47,50,'Bonthe','Cocoa','2026-06-03T12:00:00.000Z'),
('LGF-022','Yield Increase',24,43,'Moyamba','Oil Palm','2026-06-02T12:06:00.000Z'),
('LGF-023','Yield Increase',14,49,'Pujehun','Rice','2026-06-01T12:12:00.000Z'),
('LGF-024','Processing Facilities Built',26,29,'Port Loko','General','2026-05-31T12:18:00.000Z'),
('LGF-025','Seedling Survival Rate',49,56,'Kambia','Rice','2026-05-30T12:24:00.000Z'),
('LGF-026','Farmer Income',60,74,'Bombali','General','2026-06-03T12:30:00.000Z'),
('LGF-027','Road Rehab',42,74,'Tonkolili','General','2026-06-02T12:36:00.000Z'),
('LGF-028','Seedling Survival Rate',11,41,'Koinadugu','Rice','2026-06-01T12:42:00.000Z'),
('LGF-029','Farmer Income',24,61,'Falaba','General','2026-05-31T12:48:00.000Z'),
('LGF-030','Processing Facilities Built',40,61,'Karene','General','2026-05-30T12:54:00.000Z'),
('LGF-031','Seedling Survival Rate',21,22,'Western Area Rural','General','2026-06-03T13:00:00.000Z'),
('LGF-032','Farmer Income',58,77,'Western Area Urban','General','2026-06-02T13:06:00.000Z'),
('LGF-033','Processing Facilities Built',41,73,'Kailahun','Cocoa','2026-06-01T13:12:00.000Z'),
('LGF-034','Processing Facilities Built',49,78,'Kenema','Vegetables','2026-05-31T13:18:00.000Z'),
('LGF-035','Gender Inclusion',48,41,'Kono','General','2026-05-30T13:24:00.000Z'),
('LGF-036','Farmer Income',36,61,'Bo','General','2026-06-03T13:30:00.000Z'),
('LGF-037','Market Access Improvement',28,32,'Bonthe','General','2026-06-02T13:36:00.000Z'),
('LGF-038','Seedling Survival Rate',14,18,'Moyamba','Rice','2026-06-01T13:42:00.000Z'),
('LGF-039','Market Access Improvement',35,69,'Pujehun','General','2026-05-31T13:48:00.000Z'),
('LGF-040','Market Access Improvement',41,70,'Port Loko','General','2026-05-30T13:54:00.000Z'),
('LGF-041','Farmer Income',58,95,'Kambia','General','2026-06-03T14:00:00.000Z'),
('LGF-042','Processing Facilities Built',54,73,'Bombali','General','2026-06-02T14:06:00.000Z'),
('LGF-043','Processing Facilities Built',36,63,'Tonkolili','Rice','2026-06-01T14:12:00.000Z'),
('LGF-044','Road Rehab',11,27,'Koinadugu','General','2026-05-31T14:18:00.000Z'),
('LGF-045','Yield Increase',47,79,'Falaba','General','2026-05-30T14:24:00.000Z'),
('LGF-046','Yield Increase',31,33,'Karene','General','2026-06-03T14:30:00.000Z'),
('LGF-047','Seedling Survival Rate',28,38,'Western Area Rural','General','2026-06-02T14:36:00.000Z'),
('LGF-048','Gender Inclusion',44,79,'Western Area Urban','General','2026-06-01T14:42:00.000Z'),
('LGF-049','Processing Facilities Built',47,54,'Kailahun','Cocoa','2026-05-31T14:48:00.000Z'),
('LGF-050','Road Rehab',50,86,'Kenema','General','2026-05-30T14:54:00.000Z'),
('LGF-051','Road Rehab',31,40,'Kono','General','2026-06-03T15:00:00.000Z'),
('LGF-052','Seedling Survival Rate',33,28,'Bo','Oil Palm','2026-06-02T15:06:00.000Z'),
('LGF-053','Processing Facilities Built',39,58,'Bonthe','Rice','2026-06-01T15:12:00.000Z'),
('LGF-054','Market Access Improvement',49,89,'Moyamba','General','2026-05-31T15:18:00.000Z'),
('LGF-055','Yield Increase',59,77,'Pujehun','Oil Palm','2026-05-30T15:24:00.000Z'),
('LGF-056','Road Rehab',30,56,'Port Loko','General','2026-06-03T15:30:00.000Z'),
('LGF-057','Farmer Income',56,93,'Kambia','General','2026-06-02T15:36:00.000Z'),
('LGF-058','Market Access Improvement',24,62,'Bombali','General','2026-06-01T15:42:00.000Z'),
('LGF-059','Seedling Survival Rate',12,45,'Tonkolili','Oil Palm','2026-05-31T15:48:00.000Z'),
('LGF-060','Farmer Income',37,68,'Koinadugu','General','2026-05-30T15:54:00.000Z'),
('LGF-061','Processing Facilities Built',17,20,'Falaba','Rice','2026-06-03T16:00:00.000Z'),
('LGF-062','Yield Increase',45,85,'Karene','General','2026-06-02T16:06:00.000Z'),
('LGF-063','Gender Inclusion',27,29,'Western Area Rural','General','2026-06-01T16:12:00.000Z'),
('LGF-064','Yield Increase',51,88,'Western Area Urban','General','2026-05-31T16:18:00.000Z'),
('LGF-065','Seedling Survival Rate',15,39,'Kailahun','Cocoa','2026-05-30T16:24:00.000Z'),
('LGF-066','Market Access Improvement',12,50,'Kenema','General','2026-06-03T16:30:00.000Z'),
('LGF-067','Seedling Survival Rate',45,84,'Kono','Oil Palm','2026-06-02T16:36:00.000Z'),
('LGF-068','Road Rehab',16,49,'Bo','General','2026-06-01T16:42:00.000Z'),
('LGF-069','Farmer Income',12,10,'Bonthe','General','2026-05-31T16:48:00.000Z'),
('LGF-070','Seedling Survival Rate',34,69,'Moyamba','Oil Palm','2026-05-30T16:54:00.000Z'),
('LGF-071','Farmer Income',50,82,'Pujehun','General','2026-06-03T17:00:00.000Z'),
('LGF-072','Seedling Survival Rate',42,69,'Port Loko','General','2026-06-02T17:06:00.000Z'),
('LGF-073','Market Access Improvement',51,59,'Kambia','General','2026-06-01T17:12:00.000Z'),
('LGF-074','Processing Facilities Built',41,47,'Bombali','Oil Palm','2026-05-31T17:18:00.000Z'),
('LGF-075','Seedling Survival Rate',47,74,'Tonkolili','General','2026-05-30T17:24:00.000Z'),
('LGF-076','Road Rehab',31,37,'Koinadugu','General','2026-06-03T17:30:00.000Z'),
('LGF-077','Market Access Improvement',29,47,'Falaba','General','2026-06-02T17:36:00.000Z'),
('LGF-078','Farmer Income',24,29,'Karene','General','2026-06-01T17:42:00.000Z'),
('LGF-079','Market Access Improvement',30,57,'Western Area Rural','General','2026-05-31T17:48:00.000Z'),
('LGF-080','Road Rehab',11,29,'Western Area Urban','General','2026-05-30T17:54:00.000Z'),
('LGF-081','Yield Increase',46,67,'Kailahun','Cocoa','2026-06-03T18:00:00.000Z'),
('LGF-082','Yield Increase',36,67,'Kenema','Vegetables','2026-06-02T18:06:00.000Z'),
('LGF-083','Road Rehab',13,16,'Kono','General','2026-06-01T18:12:00.000Z'),
('LGF-084','Seedling Survival Rate',26,27,'Bo','Cocoa','2026-05-31T18:18:00.000Z'),
('LGF-085','Road Rehab',14,16,'Bonthe','General','2026-05-30T18:24:00.000Z'),
('LGF-086','Road Rehab',41,35,'Moyamba','General','2026-06-03T18:30:00.000Z'),
('LGF-087','Processing Facilities Built',23,43,'Pujehun','Cocoa','2026-06-02T18:36:00.000Z'),
('LGF-088','Seedling Survival Rate',13,19,'Port Loko','General','2026-06-01T18:42:00.000Z'),
('LGF-089','Yield Increase',56,70,'Kambia','Rice','2026-05-31T18:48:00.000Z'),
('LGF-090','Yield Increase',44,51,'Bombali','General','2026-05-30T18:54:00.000Z'),
('LGF-091','Processing Facilities Built',51,84,'Tonkolili','Rice','2026-06-03T19:00:00.000Z'),
('LGF-092','Seedling Survival Rate',11,41,'Koinadugu','Oil Palm','2026-06-02T19:06:00.000Z'),
('LGF-093','Road Rehab',21,31,'Falaba','General','2026-06-01T19:12:00.000Z'),
('LGF-094','Processing Facilities Built',44,69,'Karene','General','2026-05-31T19:18:00.000Z'),
('LGF-095','Market Access Improvement',49,69,'Western Area Rural','General','2026-05-30T19:24:00.000Z'),
('LGF-096','Yield Increase',33,70,'Western Area Urban','General','2026-06-03T19:30:00.000Z'),
('LGF-097','Gender Inclusion',18,21,'Kailahun','General','2026-06-02T19:36:00.000Z'),
('LGF-098','Seedling Survival Rate',60,74,'Kenema','Vegetables','2026-06-01T19:42:00.000Z'),
('LGF-099','Seedling Survival Rate',16,40,'Kono','Oil Palm','2026-05-31T19:48:00.000Z'),
('LGF-100','Seedling Survival Rate',45,67,'Bo','Oil Palm','2026-05-30T19:54:00.000Z')
on conflict (id) do nothing;

-- Logframe end-of-project targets
update public.indicators set target = round(baseline * 1.75) where target is null;

-- Surveys
insert into public.surveys (id,title,description,type,status,district,respondents_count,target_count,focal_commodity,last_conducted,indicators_affected,key_findings) values
('LGF-SUR-001','Baseline Household Income & Crop Yields Survey','Establishes baseline rice/cocoa/coffee yield metrics and household smallholder incomes before AVDP infrastructure upgrades.','Baseline Survey','Completed','Kailahun',500,500,'Cocoa','2025-01-15T00:00:00Z','{LGF-001,LGF-004,LGF-025}','Baseline cocoa crop yields sat at ~280kg/ha. Smallholder farmer financial literacy averages were below 30% without savings group memberships.'),
('LGF-SUR-002','Annual Outcome Yield & Swamp Drainage Evaluation','Measures outcomes for newly established rice swamps, assessing yield increments compared to primitive mountain terrains.','Annual Outcome Survey','Active','Moyamba',240,350,'Rice','2026-05-12T00:00:00Z','{LGF-009,LGF-012,LGF-045}','Interim records registered 42% increased rice tons per hectare where custom concrete bund systems were fully completed in swamp margins.'),
('LGF-SUR-003','Post-Planting Seedling Survival Rate Assessment','Monitors survival of oil palm, cocoa and coffee seedlings provided to smallholder farmer cooperatives under IFAD frameworks.','Seedling Survival Assessment','Active','Kenema',185,400,'Oil Palm','2026-06-01T00:00:00Z','{LGF-007,LGF-010,LGF-052}','Soil composition reviews registered high nitrogen richness, but dry season moisture drop decreased overall bare-root survival coefficients.'),
('LGF-SUR-004','Climate-Resilient Roads Transit Impact Evaluation','Conducts evaluations among transport contractors and farmer unions to measure transit time/crop spoilage reduction on rehabilitated feeder roads.','Road Impact Evaluation','Active','Kambia',110,250,'General','2026-04-20T00:00:00Z','{LGF-005,LGF-014,LGF-044}','Transit periods between harvesting hubs and bulking collection centers shortened on average by 3.4 hours. Post-harvest spoilage lowered similarly.'),
('LGF-SUR-005','Cooperatives Gender & Youth Inclusion Assessment','Audits overall participation index of women and rural youth in decision-making and operational committees of AVDP farming associations.','Gender & Youth Inclusion Survey','Scheduled','Bo',0,300,'General','2026-07-01T00:00:00Z','{LGF-003,LGF-020,LGF-035}','Targeted to start next quarter. Evaluating female inclusion ratios in VSLA groups across three experimental zones.'),
('LGF-SUR-006','Marketing Contracts & Access Review','Measures contract volumes, unit price parameters, and satisfaction levels of local farming networks transacting with bulking buyers.','Market Access & Marketing','Completed','Port Loko',200,200,'Rice','2026-02-28T00:00:00Z','{LGF-016,LGF-037,LGF-054}','Signed offtaker contract arrangements secured up to 18% premiums over open-market pricing, substantially strengthening baseline income security codes.')
on conflict (id) do nothing;

-- Survey responses (gender / youth disaggregation)
insert into public.survey_responses (survey_id,respondent_name,respondent_type,district,commodity,gender,age_group,answers,submitted_at) values
('LGF-SUR-002','Sorie Kamara','Swamp Cultivator','Moyamba','Rice','Male','Adult (36-59)','[{"question":"Total target land size pre-allocated (acres)","answer":"2.5"},{"question":"Achieved yield increase multiplier under drainage system","answer":"1.4x"},{"question":"Has household standard of living improved?","answer":"Significantly Improved"}]','2026-05-15T00:00:00Z'),
('LGF-SUR-003','Fatmata Koroma','Smallholder Farmer','Kenema','Oil Palm','Female','Youth (18-35)','[{"question":"Total oil palm seedlings distributed to farm","answer":"150"},{"question":"Confirmed active survival rate of seedlings","answer":"88%"},{"question":"Faced water shortage risks over dry season?","answer":"Yes - Moderate Drought"}]','2026-06-02T00:00:00Z');

-- Alerts
insert into public.alerts (indicator_id,indicator_name,district,threshold_value,current_value,condition,recipient_email,status,enabled,triggered_at) values
('LGF-001','Yield Increase','Kailahun',110,85,'below','district.officer.kailahun@avdp.org.sl','Sent',true,'2026-05-28T09:30:00Z'),
('LGF-086','Road Rehab','Moyamba',110,85.4,'below','infrastructure.director@avdp.org.sl','Sent',true,'2026-06-02T14:15:00Z');

-- Audit log
insert into public.activity_logs (ts,user_email,role,action) values
('2026-06-03T22:15:00Z','moh.bangura@avdp.gov.sl','Admin','Updated database schema for Western Area districts'),
('2026-06-03T21:30:00Z','officer.kailahun@avdp.org.sl','Officer','Logged new Coffee yield survey parameters for index LGF-025'),
('2026-06-03T18:45:00Z','System Scheduler','System','Triggered email threshold warning alert for indicator LGF-001 below 110% target'),
('2026-06-03T12:00:00Z','public.viewer@avdp.org.sl','Stakeholder','Exported national yield summary reports as CSV');

-- Demo auth users (real Supabase Auth accounts; passwords match the in-app presets)
do $$
declare uid uuid; rec record;
begin
  for rec in
    select * from (values
      ('admin@avdp.org.sl','adminPassword2026','Mohamed Bangura','Admin', null),
      ('officer.kenema@avdp.org.sl','kenemaOfficer7','Sorie Kamara','Officer','Kenema'),
      ('ifad.auditor@avdp.org.sl','ifadPassword','Dr. Elena Rossi','Stakeholder', null)
    ) as t(email, pw, fullname, role, district)
  loop
    if exists (select 1 from auth.users where email = rec.email) then continue; end if;
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', rec.email, crypt(rec.pw, gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('name', rec.fullname, 'role', rec.role, 'district', rec.district), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', rec.email), 'email', now(), now(), now());
  end loop;
end $$;

-- Generate an initial populated digest now that indicators exist
select public.generate_me_digest();
