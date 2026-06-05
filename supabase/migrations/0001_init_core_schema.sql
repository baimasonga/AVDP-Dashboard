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
