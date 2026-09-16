-- =============================================================================
-- Migration 017: Seed fictional teachers and assign to classes
-- =============================================================================
-- ALL DATA IS FICTIONAL.  No real staff information is used.

-- ─── Foundation seed (school + classes must exist before teachers FK) ─────────

INSERT INTO public.schools (id, name, roll_number, address_line1, city, county, eircode, phone, email, website)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Scoil Bhríde',
  '12345A',
  '1 School Road',
  'Citywest',
  'Dublin',
  'D24 AB12',
  '01 123 4567',
  'office@scoilbhride.example.ie',
  'https://www.scoilbhride.example.ie'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.school_settings (school_id, key, value, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'notification_email', 'office@scoilbhride.example.ie', 'General school notification email address'),
  ('00000000-0000-0000-0000-000000000001', 'portal_name', 'Scoil Bhríde Payment Portal', 'Display name for the portal'),
  ('00000000-0000-0000-0000-000000000001', 'currency', 'EUR', 'Payment currency'),
  ('00000000-0000-0000-0000-000000000001', 'stripe_mode', 'test', 'Stripe environment: test or live'),
  ('00000000-0000-0000-0000-000000000001', 'data_retention_months', '84', 'Data retention period in months (7 years default)')
ON CONFLICT (school_id, key) DO NOTHING;

INSERT INTO public.classes (id, school_id, name, display_order)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Junior Infants',  1),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Senior Infants',  2),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'First Class',     3),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Second Class',    4),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Third Class',     5),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Fourth Class',    6),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Fifth Class',     7),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Sixth Class',     8)
ON CONFLICT (id) DO NOTHING;

-- ─── Fictional teachers ───────────────────────────────────────────────────────

INSERT INTO public.teachers (id, school_id, first_name, last_name, email, is_active)
VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Máire',    'Ní Bhriain',       'mbriain@scoilbhride.example.ie',          TRUE),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Seán',     'Ó Dochartaigh',    'sodochartaigh@scoilbhride.example.ie',    TRUE),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Caoimhe',  'Mhic Gearailt',    'cmhicgearailt@scoilbhride.example.ie',    TRUE),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Pádraig',  'Ó Maolalaidh',     'pomaolalaidh@scoilbhride.example.ie',     TRUE),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Bríd',     'Uí Cheallaigh',    'buiceallaigh@scoilbhride.example.ie',     TRUE),
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Tomás',    'Mac Cormaic',      'tmaccormaic@scoilbhride.example.ie',      TRUE),
  ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Aoife',    'Ní Shúilleabháin', 'anishuilleabhain@scoilbhride.example.ie', TRUE),
  ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Ciarán',   'Ó Briain',         'cobriain@scoilbhride.example.ie',         TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── Assign teachers to classes (2025–2026 academic year) ────────────────────

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000001',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000001';  -- Junior Infants

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000002',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000002';  -- Senior Infants

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000003',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000003';  -- First Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000004',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000004';  -- Second Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000005',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000005';  -- Third Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000006',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000006';  -- Fourth Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000007',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000007';  -- Fifth Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000008',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000008';  -- Sixth Class
