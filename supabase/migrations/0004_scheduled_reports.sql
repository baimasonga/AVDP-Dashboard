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
