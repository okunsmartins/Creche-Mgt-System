-- 114_get_user_permissions_self_only.sql
--
-- Tightens public.get_user_permissions(p_user_id, p_school_id) (migration 004).
--
-- Why: it is SECURITY DEFINER and was callable through the data API by anyone, signed
-- in or not (Supabase grants EXECUTE on public functions to anon and authenticated by
-- default). Given someone else's user id and crèche id it returned that person's
-- permission names. No child or family data, but more than anyone needs (noted in the
-- 2026-11-24 review, fixed in the 2026-11-27 review).
--
-- Now:
--  * a signed-in user gets an answer only about THEMSELVES (p_user_id = auth.uid());
--  * the service role (the app's server) can ask about anyone. It has no auth.uid();
--    signed-in users always do, so "no uid" can only be the server or the SQL editor;
--  * anon can't call it at all (EXECUTE revoked below; it has no uid either).
-- The app reads permissions with the service role (src/lib/auth/session.ts), so this
-- is safe to apply before or after that code is deployed.
--
-- Also pins search_path (a SECURITY DEFINER function should never depend on the
-- caller's search_path); every name in the body is schema-qualified.
--
-- Verify after applying: node scripts/verify-mfa-policies.mjs .env.local
--   → "anon blocked: … get_user_permissions".
-- Rollback: re-run the function from 004_profiles_and_roles.sql, then
--   grant execute on function public.get_user_permissions(uuid, uuid) to anon, authenticated;

create or replace function public.get_user_permissions(p_user_id uuid, p_school_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_agg(distinct pe.name)
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions pe on pe.id = rp.permission_id
  where ur.user_id = p_user_id
    and ur.school_id = p_school_id
    -- Signed-in users always have a uid, so they only ever match themselves.
    -- No uid = the service role / SQL editor (anon has no EXECUTE, see below).
    and (auth.uid() is null or p_user_id = auth.uid());
$$;

revoke all on function public.get_user_permissions(uuid, uuid) from public, anon;
grant execute on function public.get_user_permissions(uuid, uuid) to authenticated, service_role;
