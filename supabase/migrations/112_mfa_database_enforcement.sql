-- 112_mfa_database_enforcement.sql
--
-- Two-step sign-in (TOTP MFA) enforced in the DATABASE, not only in the app.
--
-- Why: the app already requires the 6-digit code on every admin page, action and API
-- route (requireAuth → mfa-policy.ts). But Supabase's data API can be reached directly
-- with the public anon key: someone who knows an admin's PASSWORD (not the code) can
-- sign in to Supabase themselves, get a password-only session (aal1), and read the
-- tables whose RLS policies admit admins (is_admin() / is_admin_of_school()). This
-- closes that gap (found in the 2026-11-24 review).
--
-- Rule (Supabase's documented MFA pattern): a user who HAS a verified authenticator
-- may only touch data from a session where the code was entered (aal2). Users with no
-- authenticator (parents, staff, admins still in their grace period) are unaffected,
-- and so is the service role the app's server uses (it bypasses RLS).
--
-- Mechanism: ONE extra RESTRICTIVE policy, `mfa_required`, on every RLS-enabled table
-- in `public`. Restrictive policies are AND-ed with the existing (permissive) ones, so
-- nothing anyone can see today becomes visible; enrolled users on aal1 just see nothing.
--
-- New tables: call `select public.ensure_mfa_policy('<table>');` in the migration that
-- creates them (src/lib/__tests__/migration-grants.test.ts enforces this from 113 on).
--
-- Verify after applying: supabase/checks/112_mfa_check.sql (read-only, rolls back), and
-- `node scripts/verify-mfa-policies.mjs .env.local` (no gaps expected).
--
-- Rollback (if ever needed), run in the SQL editor:
--   do $$ declare r record; begin
--     for r in select tablename from pg_policies
--              where schemaname = 'public' and policyname = 'mfa_required'
--     loop execute format('drop policy if exists mfa_required on public.%I', r.tablename);
--     end loop; end $$;
--   drop function if exists public.mfa_policy_gaps();
--   drop function if exists public.ensure_mfa_policy(text);
--   drop function if exists public.mfa_satisfied();

-- 1) Is this session's two-step sign-in good enough?
--    True when the code was entered (aal2), or when the user has no verified
--    authenticator at all. Same logic as Supabase's documented MFA policy.
--    SECURITY DEFINER (owner = postgres, which can always read auth.mfa_factors), so
--    the rule never depends on whether API roles may read the auth schema: if they
--    couldn't, an invoker function would make EVERY signed-in query fail. It only
--    looks at the CALLER's own factors (auth.uid()) and returns a yes/no.
create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1
        from auth.mfa_factors f
        where f.user_id = auth.uid()
          and f.status = 'verified'
      );
$$;

revoke all on function public.mfa_satisfied() from public;
-- Only signed-in users are subject to the rule (anon can't have an authenticator).
grant execute on function public.mfa_satisfied() to authenticated, service_role;

-- 2) Add (or re-add) the restrictive policy to one table. Used below for every
--    existing table, and by future migrations for new ones. Not callable via the API.
create or replace function public.ensure_mfa_policy(p_table text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('drop policy if exists mfa_required on public.%I', p_table);
  -- (select …) is evaluated once per statement, not once per row.
  execute format(
    'create policy mfa_required on public.%I as restrictive for all to authenticated '
    'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
    p_table
  );
end;
$$;

revoke all on function public.ensure_mfa_policy(text) from public, anon, authenticated;

-- 3) Apply to every RLS-enabled table in public (78 at the time of writing).
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
  loop
    perform public.ensure_mfa_policy(r.relname);
    n := n + 1;
  end loop;
  raise notice 'mfa_required added to % tables', n;
end;
$$;

-- 4) Tables with RLS switched OFF are not protected by any policy (this one included).
--    There should be none; warn loudly if there are.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;
  if missing is not null then
    raise warning 'RLS is OFF (not covered by mfa_required): %', missing;
  end if;
end;
$$;

-- 5) Coverage report for the verification script: tables in public that are NOT
--    protected (RLS off, or no mfa_required policy). Service role only.
create or replace function public.mfa_policy_gaps()
returns table (table_name text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text,
         case when not c.relrowsecurity then 'rls_off' else 'no_mfa_policy' end
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      not c.relrowsecurity
      or not exists (
        select 1
        from pg_catalog.pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
          and p.policyname = 'mfa_required'
          and p.permissive = 'RESTRICTIVE'
      )
    )
  order by 1;
$$;

revoke all on function public.mfa_policy_gaps() from public, anon, authenticated;
grant execute on function public.mfa_policy_gaps() to service_role;
