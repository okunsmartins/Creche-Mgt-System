-- 037: Per-school pupil payment code prefix
--
-- Previously generate_pupil_code() hard-coded the "SB-" prefix (a Scoil Bhríde
-- legacy), so every tenant's pupil codes looked like another school's. This
-- parameterises the prefix so each school's codes reflect its own name
-- (e.g. "SPP-…" for St Peters Primary School). The prefix is sanitised here as a
-- defence-in-depth measure even though callers pass a clean value.
--
-- The DEFAULT keeps existing call sites working and preserves "SB" as the
-- fallback for any caller that omits the argument.

-- Drop the old zero-argument version so the defaulted one isn't ambiguous.
DROP FUNCTION IF EXISTS public.generate_pupil_code();

CREATE OR REPLACE FUNCTION public.generate_pupil_code(p_prefix TEXT DEFAULT 'SB')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- omit I, O, 0, 1
  v_prefix TEXT;
  v_code   TEXT;
  v_i      INTEGER;
BEGIN
  -- Sanitise: uppercase, alphanumeric only, 2–4 chars; fall back to 'SB'.
  v_prefix := upper(regexp_replace(COALESCE(p_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
  v_prefix := substr(v_prefix, 1, 4);
  IF length(v_prefix) < 2 THEN
    v_prefix := 'SB';
  END IF;

  v_code := v_prefix || '-';
  FOR v_i IN 1..8 LOOP
    v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN v_code;
END;
$$;
