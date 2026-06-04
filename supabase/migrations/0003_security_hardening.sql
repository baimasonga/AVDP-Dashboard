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
