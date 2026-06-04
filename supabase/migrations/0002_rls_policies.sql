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
