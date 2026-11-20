-- 110: Close three inherited "public read" policies (security spot-check 2026-11-20).
--
-- An anon-key sweep of every table found these readable by ANYONE with the public
-- (anon) key, across every crèche:
--   * payment_links              — every active link incl. its public_token
--   * activity_class_eligibility — which rooms each activity is open to
--   * activity_pupil_eligibility — which children (by id) each activity is open to
--
-- The app never reads them with the anon/user client: /pay/[token], guest payment,
-- public + parent activity pages and all actions use the service-role client, which
-- bypasses RLS and is scoped by school/token in code. So the public policies only
-- served direct API access. Admin policies are untouched.
--
-- `activities` keeps public_read_published_activities on purpose (published activities
-- are public, and /parent/payments reads them with the user client).

DROP POLICY IF EXISTS "public_read_active_payment_link_by_token" ON public.payment_links;
DROP POLICY IF EXISTS "public_read_eligibility" ON public.activity_class_eligibility;
DROP POLICY IF EXISTS "public_read_pupil_eligibility" ON public.activity_pupil_eligibility;

REVOKE SELECT ON public.payment_links              FROM anon;
REVOKE SELECT ON public.activity_class_eligibility FROM anon;
REVOKE SELECT ON public.activity_pupil_eligibility FROM anon;

-- Verify (expect 0 rows each when run with the anon key; service role unaffected):
--   select count(*) from public.payment_links;
