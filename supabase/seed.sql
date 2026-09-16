-- =============================================================================
-- Scoil Bhríde Payment Portal — Fictional Seed Data
-- =============================================================================
-- ALL DATA IS FICTIONAL. No real pupil, parent or staff information is used.
-- This seed is for development and demonstration purposes only.
--
-- IMPORTANT: The super administrator account must be created separately through
-- the Supabase Auth dashboard or CLI. See docs/deployment.md for instructions.
-- Do NOT commit real email addresses or passwords to source control.
-- =============================================================================

-- ─── School ──────────────────────────────────────────────────────────────────

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

-- ─── School settings ─────────────────────────────────────────────────────────

INSERT INTO public.school_settings (school_id, key, value, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'notification_email', 'office@scoilbhride.example.ie', 'General school notification email address'),
  ('00000000-0000-0000-0000-000000000001', 'portal_name', 'Scoil Bhríde Payment Portal', 'Display name for the portal'),
  ('00000000-0000-0000-0000-000000000001', 'currency', 'EUR', 'Payment currency'),
  ('00000000-0000-0000-0000-000000000001', 'stripe_mode', 'test', 'Stripe environment: test or live'),
  ('00000000-0000-0000-0000-000000000001', 'data_retention_months', '84', 'Data retention period in months (7 years default)')
ON CONFLICT (school_id, key) DO NOTHING;

-- ─── Classes (8 required Irish primary school classes) ────────────────────────

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

-- ─── Fictional students (20 across all classes) ───────────────────────────────
-- Pupil payment codes pre-generated for predictable testing.

INSERT INTO public.students (id, school_id, first_name, last_name, class_id, pupil_payment_code)
VALUES
  -- Junior Infants (3)
  -- Codes use only: A-H J-N P-Z 2-9  (no I O 0 1 — see generate_pupil_code() in migration 002)
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Aoife',    'Murphy',    '10000000-0000-0000-0000-000000000001', 'SB-AM224567'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ciarán',   'O''Brien',  '10000000-0000-0000-0000-000000000001', 'SB-CB334567'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Siobhán',  'Kelly',     '10000000-0000-0000-0000-000000000001', 'SB-SK445678'),
  -- Senior Infants (2)
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Darragh',  'Walsh',     '10000000-0000-0000-0000-000000000002', 'SB-DW556789'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Niamh',    'Ryan',      '10000000-0000-0000-0000-000000000002', 'SB-NR667892'),
  -- First Class (3)
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Conor',    'Brennan',   '10000000-0000-0000-0000-000000000003', 'SB-CB778923'),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Éabha',    'Doyle',     '10000000-0000-0000-0000-000000000003', 'SB-ED889234'),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Tadhg',    'Fitzgerald','10000000-0000-0000-0000-000000000003', 'SB-TF992345'),
  -- Second Class (2)
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Clodagh',  'McCarthy',  '10000000-0000-0000-0000-000000000004', 'SB-CM223456'),
  ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Fionn',    'O''Connor', '10000000-0000-0000-0000-000000000004', 'SB-FC334567'),
  -- Third Class (2)
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Grainne',  'Quinn',     '10000000-0000-0000-0000-000000000005', 'SB-GQ445678'),
  ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Seán',     'Burke',     '10000000-0000-0000-0000-000000000005', 'SB-SB556789'),
  -- Fourth Class (3)
  ('20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Roisín',   'Collins',   '10000000-0000-0000-0000-000000000006', 'SB-RC667892'),
  ('20000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Oisín',    'Dempsey',   '10000000-0000-0000-0000-000000000006', 'SB-PD778923'),
  ('20000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Caoimhe',  'Farrell',   '10000000-0000-0000-0000-000000000006', 'SB-CF889234'),
  -- Fifth Class (3)
  ('20000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'Cillian',  'Hayes',     '10000000-0000-0000-0000-000000000007', 'SB-KH992345'),
  ('20000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'Saoirse',  'Lynch',     '10000000-0000-0000-0000-000000000007', 'SB-SL223467'),
  ('20000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'Cathal',   'Nolan',     '10000000-0000-0000-0000-000000000007', 'SB-CN334568'),
  -- Sixth Class (2)
  ('20000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'Áine',     'Power',     '10000000-0000-0000-0000-000000000008', 'SB-AP445679'),
  ('20000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Cormac',   'Sheridan',  '10000000-0000-0000-0000-000000000008', 'SB-CS556782')
ON CONFLICT (id) DO NOTHING;

-- ─── Activities ───────────────────────────────────────────────────────────────

INSERT INTO public.activities (id, school_id, name, description, amount_cents, accounting_code, opens_at, closes_at, publication_status, is_active)
VALUES
  -- 1. Active: school trip for all classes
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Dublin Zoo School Trip',
    'Annual trip to Dublin Zoo. Includes coach transport and entry fee. Please pay by the closing date.',
    2500,    -- €25.00
    'TRIPS-2025',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '21 days',
    'published',
    TRUE
  ),
  -- 2. Active: adventure trip for 5th and 6th class
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Zipit Adventure Trip',
    'Two-hour outdoor adventure activity at Zipit Forest Adventures. Suitable for 5th and 6th class.',
    3500,    -- €35.00
    'TRIPS-2025',
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '14 days',
    'published',
    TRUE
  ),
  -- 3. Active: book rental for all classes
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Book Rental Scheme 2025–2026',
    'Annual book rental contribution covering core curriculum books.',
    7500,    -- €75.00
    'BOOKS-2025',
    NOW() - INTERVAL '14 days',
    NOW() + INTERVAL '60 days',
    'published',
    TRUE
  ),
  -- 4. Active: school uniform (all classes)
  (
    '30000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'School Uniform Order',
    'Order school jumpers, tracksuit tops and PE T-shirts through the portal.',
    4000,    -- €40.00
    'UNIFORM-2025',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '30 days',
    'published',
    TRUE
  ),
  -- 5. Future: not yet open
  (
    '30000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Christmas Pantomime 2025',
    'Visit to the Gaiety Theatre for the annual Christmas pantomime. Places are limited.',
    1500,    -- €15.00
    'TRIPS-2025',
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '60 days',
    'published',
    TRUE
  ),
  -- 6. Closed: past closing date
  (
    '30000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Science Week Workshop',
    'Interactive science workshop delivered by ScienceXplosion. Now closed.',
    800,     -- €8.00
    'EVENTS-2025',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '10 days',
    'published',
    TRUE
  ),
  -- 7. Unpublished / draft
  (
    '30000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'Spring Sports Day — DRAFT',
    'Sports day contribution for equipment and prizes. Not yet published.',
    500,     -- €5.00
    'EVENTS-2026',
    NULL,
    NULL,
    'draft',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Activity class eligibility ───────────────────────────────────────────────

-- Dublin Zoo: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000001', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Zipit Adventure: 5th and 6th class only
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
VALUES
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008')
ON CONFLICT DO NOTHING;

-- Book Rental: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000003', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Uniform: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000004', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Christmas Panto: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000005', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Science Week: 3rd, 4th, 5th class
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
VALUES
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- Sports Day: all classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000007', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Administrator Account Setup
-- =============================================================================
-- The super administrator account is NOT seeded here for security reasons.
-- Create it securely using one of the following methods:
--
-- Option A — Supabase Dashboard:
--   1. Go to Authentication → Users → Invite user
--   2. Use email: admin@scoilbhride.example.ie (or your own)
--   3. After the user sets a password, run the SQL below to assign the role:
--
-- Option B — Supabase CLI:
--   supabase auth create-user --email admin@scoilbhride.example.ie
--   (Set a strong password interactively — never commit passwords)
--
-- After creating the auth user, run this SQL (replacing the UUID):
-- =============================================================================
--
-- INSERT INTO public.user_roles (user_id, role_id, school_id, granted_by)
-- SELECT
--   '<auth-user-uuid>',
--   r.id,
--   '00000000-0000-0000-0000-000000000001',
--   '<auth-user-uuid>'
-- FROM public.roles r
-- WHERE r.name = 'super_admin';
--
-- =============================================================================
-- Fictional parent profiles are also created through Auth registration.
-- After registration, link them to students using:
--
-- INSERT INTO public.parent_student_links (parent_id, student_id, school_id, relationship)
-- VALUES ('<parent-uuid>', '<student-uuid>', '00000000-0000-0000-0000-000000000001', 'parent');
-- =============================================================================
