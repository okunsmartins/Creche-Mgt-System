-- =============================================================================
-- Migration 009: Seed roles and permissions
-- =============================================================================

-- Roles
INSERT INTO public.roles (name, display_name, description) VALUES
  ('super_admin',   'Super Administrator', 'Full system access including school configuration and role management'),
  ('school_admin',  'School Administrator', 'Manages students, activities, payments and reports'),
  ('finance_admin', 'Finance Administrator', 'Views payments, issues refunds, exports reports'),
  ('teacher',       'Teacher', 'Views payment status for authorised classes'),
  ('parent',        'Parent / Guardian', 'Makes payments for linked children')
ON CONFLICT (name) DO NOTHING;

-- Permissions
INSERT INTO public.permissions (name, description) VALUES
  -- School configuration
  ('school.configure',           'Configure school details and settings'),
  -- User & role management
  ('users.manage',               'Create, deactivate and assign roles to users'),
  ('roles.assign',               'Assign roles to users'),
  -- Student management
  ('students.create',            'Create new student records'),
  ('students.update',            'Edit student records'),
  ('students.deactivate',        'Deactivate students'),
  ('students.view',              'View student records'),
  ('students.view_class',        'View students in authorised classes only'),
  -- Parent linking
  ('parent_links.manage',        'Create and remove parent-student links'),
  ('parent_links.approve',       'Approve or reject parent link requests'),
  -- Activity management
  ('activities.create',          'Create activities'),
  ('activities.update',          'Edit activities'),
  ('activities.publish',         'Publish or archive activities'),
  ('activities.view',            'View all activities'),
  -- Order & payment management
  ('orders.view',                'View all orders'),
  ('payments.view',              'View all payments'),
  ('payments.refund',            'Issue refunds'),
  ('reconciliation.resolve',     'Resolve manual reconciliation items'),
  -- Reports
  ('reports.view',               'View reports'),
  ('reports.export',             'Export reports as CSV'),
  -- Audit
  ('audit.view',                 'View audit logs'),
  -- Email
  ('emails.resend',              'Resend notification emails'),
  -- Parent-specific
  ('parent.pay',                 'Make payments for linked children'),
  ('parent.view_own',            'View own orders and receipts')
ON CONFLICT (name) DO NOTHING;

-- ─── Role → Permission assignments ───────────────────────────────────────────

-- Super admin gets everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- School admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'school_admin'
  AND p.name IN (
    'students.create', 'students.update', 'students.deactivate', 'students.view',
    'parent_links.manage', 'parent_links.approve',
    'activities.create', 'activities.update', 'activities.publish', 'activities.view',
    'orders.view', 'payments.view', 'payments.refund',
    'reconciliation.resolve',
    'reports.view', 'reports.export',
    'emails.resend'
  )
ON CONFLICT DO NOTHING;

-- Finance admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'finance_admin'
  AND p.name IN (
    'students.view',
    'activities.view',
    'orders.view', 'payments.view', 'payments.refund',
    'reconciliation.resolve',
    'reports.view', 'reports.export',
    'audit.view',
    'emails.resend'
  )
ON CONFLICT DO NOTHING;

-- Teacher
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'teacher'
  AND p.name IN (
    'students.view_class',
    'activities.view'
  )
ON CONFLICT DO NOTHING;

-- Parent
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'parent'
  AND p.name IN (
    'parent.pay',
    'parent.view_own'
  )
ON CONFLICT DO NOTHING;
