-- =============================================================================
-- Migration 010: Row Level Security policies
-- =============================================================================
-- Service-role operations bypass RLS (correct by design).
-- Browser clients use the anon key and are subject to all policies below.
-- =============================================================================

-- ─── schools ─────────────────────────────────────────────────────────────────

-- Admins can read their school; public cannot see school records
CREATE POLICY "admins_read_school" ON public.schools
  FOR SELECT USING (public.is_admin());

CREATE POLICY "super_admin_manage_schools" ON public.schools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ─── school_settings ─────────────────────────────────────────────────────────

CREATE POLICY "admins_read_school_settings" ON public.school_settings
  FOR SELECT USING (public.is_admin());

CREATE POLICY "super_admin_manage_school_settings" ON public.school_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Users can read and update their own profile
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Admins can read all profiles in their school
CREATE POLICY "admins_read_profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "admins_manage_profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- ─── roles / permissions / role_permissions / user_roles ─────────────────────

CREATE POLICY "authenticated_read_roles" ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated_read_permissions" ON public.permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated_read_role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "users_read_own_user_roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_read_user_roles" ON public.user_roles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "super_admin_manage_user_roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ─── classes ─────────────────────────────────────────────────────────────────

-- All authenticated users can read classes (needed for dropdowns)
CREATE POLICY "authenticated_read_classes" ON public.classes
  FOR SELECT TO authenticated USING (TRUE);

-- Anon users can read classes (needed for guest payment class dropdown)
CREATE POLICY "anon_read_classes" ON public.classes
  FOR SELECT TO anon USING (is_active = TRUE);

CREATE POLICY "admins_manage_classes" ON public.classes
  FOR ALL USING (public.is_admin());

-- ─── students ────────────────────────────────────────────────────────────────

-- Parents see only students linked to them
CREATE POLICY "parents_read_linked_students" ON public.students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.student_id = students.id
        AND psl.parent_id = auth.uid()
        AND psl.is_active = TRUE
    )
  );

-- Teachers see students in their authorised classes
-- (teacher_class_assignments table added in Phase 3; stubbed here)
CREATE POLICY "teachers_read_class_students" ON public.students
  FOR SELECT USING (
    public.user_has_permission('students.view_class')
    -- Additional class restriction enforced at application layer in Phase 3
  );

-- Admins can manage all students in their school
CREATE POLICY "admins_manage_students" ON public.students
  FOR ALL USING (public.user_has_permission('students.view'));

-- Guests cannot query the students table directly
-- (no policy = no access for anon role)

-- ─── parent_student_links ────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_links" ON public.parent_student_links
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "admins_manage_parent_links" ON public.parent_student_links
  FOR ALL USING (public.user_has_permission('parent_links.manage'));

-- ─── parent_link_requests ────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_requests" ON public.parent_link_requests
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "parents_create_requests" ON public.parent_link_requests
  FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "admins_manage_link_requests" ON public.parent_link_requests
  FOR ALL USING (public.user_has_permission('parent_links.approve'));

-- ─── activities ──────────────────────────────────────────────────────────────

-- Authenticated users and guests see published, active activities
CREATE POLICY "public_read_published_activities" ON public.activities
  FOR SELECT USING (
    publication_status = 'published'
    AND is_active = TRUE
    AND (opens_at IS NULL OR opens_at <= NOW())
    AND (closes_at IS NULL OR closes_at > NOW())
  );

CREATE POLICY "admins_read_all_activities" ON public.activities
  FOR SELECT USING (public.user_has_permission('activities.view'));

CREATE POLICY "admins_manage_activities" ON public.activities
  FOR ALL USING (public.user_has_permission('activities.create'));

-- ─── activity_class_eligibility ──────────────────────────────────────────────

CREATE POLICY "public_read_eligibility" ON public.activity_class_eligibility
  FOR SELECT USING (TRUE);

CREATE POLICY "admins_manage_eligibility" ON public.activity_class_eligibility
  FOR ALL USING (public.user_has_permission('activities.create'));

-- ─── orders ──────────────────────────────────────────────────────────────────

-- Registered parents see their own orders
CREATE POLICY "parents_read_own_orders" ON public.orders
  FOR SELECT USING (payer_profile_id = auth.uid());

CREATE POLICY "parents_create_orders" ON public.orders
  FOR INSERT WITH CHECK (
    payer_profile_id = auth.uid()
    OR payer_profile_id IS NULL  -- guest orders created server-side
  );

CREATE POLICY "admins_read_all_orders" ON public.orders
  FOR SELECT USING (public.user_has_permission('orders.view'));

CREATE POLICY "admins_update_orders" ON public.orders
  FOR UPDATE USING (public.user_has_permission('orders.view'));

-- ─── order_items ─────────────────────────────────────────────────────────────

-- Parents see items on their own orders
CREATE POLICY "parents_read_own_order_items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.payer_profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_read_all_order_items" ON public.order_items
  FOR SELECT USING (public.user_has_permission('orders.view'));

CREATE POLICY "admins_manage_order_items" ON public.order_items
  FOR ALL USING (public.user_has_permission('orders.view'));

-- ─── payments ────────────────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.payer_profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_read_all_payments" ON public.payments
  FOR SELECT USING (public.user_has_permission('payments.view'));

CREATE POLICY "admins_manage_payments" ON public.payments
  FOR ALL USING (public.user_has_permission('payments.view'));

-- ─── refunds ─────────────────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_refunds" ON public.refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refunds.order_id
        AND o.payer_profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_read_all_refunds" ON public.refunds
  FOR SELECT USING (public.user_has_permission('payments.view'));

CREATE POLICY "admins_manage_refunds" ON public.refunds
  FOR ALL USING (public.user_has_permission('payments.refund'));

-- ─── webhook_events ──────────────────────────────────────────────────────────

-- Webhook events are managed exclusively via service role (no user policies)
-- Admins can view for debugging
CREATE POLICY "admins_read_webhook_events" ON public.webhook_events
  FOR SELECT USING (public.user_has_permission('payments.view'));

-- ─── email_notifications ─────────────────────────────────────────────────────

CREATE POLICY "admins_manage_email_notifs" ON public.email_notifications
  FOR ALL USING (public.user_has_permission('emails.resend'));

-- ─── audit_logs ──────────────────────────────────────────────────────────────

-- Audit logs are append-only — no UPDATE or DELETE policies
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
  FOR SELECT USING (public.user_has_permission('audit.view'));

-- Only service role (server-side) can insert audit logs
-- Revoke direct insert from authenticated role
REVOKE INSERT ON public.audit_logs FROM authenticated;
REVOKE INSERT ON public.audit_logs FROM anon;
