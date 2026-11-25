-- Check for migration 112 (two-step sign-in enforced in the database).
-- READ-ONLY: it only counts rows, and it always ends by raising an "error" that shows
-- the results. Raising the error also undoes everything it did, so nothing changes.
-- Paste it all into the Supabase SQL editor and click Run.
--
-- It pretends to be:
--   A) an admin who HAS an authenticator, signed in with the password only (aal1)
--   B) the same admin after entering the code (aal2)
--   C) a parent with no authenticator (aal1), as parents always are
-- and counts the children each one can see through Supabase's data API.
--
-- Expected: gaps = 0 · A = 0 · B > 0 · C > 0.
-- If A > 0 the rule isn't working. If you get "permission denied", the database
-- refused part of the check; send a screenshot (nothing has changed).

do $$
declare
  v_admin uuid;
  v_parent uuid;
  v_gaps int;
  v_a bigint;
  v_b bigint;
  v_c bigint;
begin
  select f.user_id into v_admin
  from auth.mfa_factors f
  where f.status = 'verified'
  limit 1;
  if v_admin is null then
    raise exception 'MFA CHECK: nobody has set up an authenticator yet, so there is nothing to check.';
  end if;

  select l.parent_id into v_parent
  from public.parent_student_links l
  where l.is_active
    and not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = l.parent_id and f.status = 'verified'
    )
  limit 1;

  select count(*) into v_gaps from public.mfa_policy_gaps();

  -- A) admin, password only
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
  select count(*) into v_a from public.students;
  reset role;

  -- B) same admin, code entered
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  select count(*) into v_b from public.students;
  reset role;

  -- C) a parent (no authenticator), password only
  if v_parent is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_parent, 'role', 'authenticated', 'aal', 'aal1')::text, true);
    set local role authenticated;
    select count(*) into v_c from public.students;
    reset role;
  end if;

  raise exception
    'MFA CHECK (nothing was changed) | tables without the rule: % (expect 0) | A admin, password only: % children (expect 0) | B same admin with code: % (expect more than 0) | C parent: % (expect more than 0)',
    v_gaps, v_a, v_b, coalesce(v_c::text, 'no parent found');
end;
$$;
