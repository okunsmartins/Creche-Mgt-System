-- =============================================================================
-- Migration 035: RLS hardening, slice 2 — school-scoped admin policies
-- =============================================================================
-- Rewrites the admin RLS policies (migrations 010/012/014/025/031) which were
-- NOT school-scoped (they used user_has_permission()/is_admin() with no
-- school_id check) into versions scoped with is_admin_of_school(school_id)
-- (migration 034). After this an admin only sees/manages rows in their OWN
-- school via the RLS client.
--
-- SAFE TO APPLY NOW: the running app reads/writes via the service-role client,
-- which BYPASSES RLS — so these policy changes do not alter current behaviour.
-- They take effect when reads switch to the RLS client (slice 3), and provide
-- defence-in-depth immediately.
--
-- Tables with a direct school_id use is_admin_of_school(school_id).
-- Child tables (no school_id) scope via their parent (orders / activities).
-- programmes + programme_class_eligibility (migration 027) are already
-- school-scoped and are left unchanged. webhook_events has no school_id
-- (global Stripe events) and is left as an admin-only operational table.

-- ─── schools / school_settings / profiles ────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_school" ON public.schools;
CREATE POLICY "admins_read_school" ON public.schools
  FOR SELECT USING (public.is_admin_of_school(id));

DROP POLICY IF EXISTS "admins_read_school_settings" ON public.school_settings;
CREATE POLICY "admins_read_school_settings" ON public.school_settings
  FOR SELECT USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_read_profiles" ON public.profiles;
CREATE POLICY "admins_read_profiles" ON public.profiles
  FOR SELECT USING (school_id IS NOT NULL AND public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_profiles" ON public.profiles;
CREATE POLICY "admins_manage_profiles" ON public.profiles
  FOR ALL USING (school_id IS NOT NULL AND public.is_admin_of_school(school_id));

-- ─── classes / students ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_classes" ON public.classes;
CREATE POLICY "admins_manage_classes" ON public.classes
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_students" ON public.students;
CREATE POLICY "admins_manage_students" ON public.students
  FOR ALL USING (public.is_admin_of_school(school_id));

-- Teacher read of students: keep the permission check but scope to the
-- teacher's own school (was unscoped — could leak cross-school).
DROP POLICY IF EXISTS "teachers_read_class_students" ON public.students;
CREATE POLICY "teachers_read_class_students" ON public.students
  FOR SELECT USING (
    public.user_has_permission('students.view_class')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── parent links ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_parent_links" ON public.parent_student_links;
CREATE POLICY "admins_manage_parent_links" ON public.parent_student_links
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_link_requests" ON public.parent_link_requests;
CREATE POLICY "admins_manage_link_requests" ON public.parent_link_requests
  FOR ALL USING (public.is_admin_of_school(school_id));

-- ─── activities + eligibility ────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_all_activities" ON public.activities;
CREATE POLICY "admins_read_all_activities" ON public.activities
  FOR SELECT USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_activities" ON public.activities;
CREATE POLICY "admins_manage_activities" ON public.activities
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_eligibility" ON public.activity_class_eligibility;
CREATE POLICY "admins_manage_eligibility" ON public.activity_class_eligibility
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_class_eligibility.activity_id
        AND public.is_admin_of_school(a.school_id)
    )
  );

DROP POLICY IF EXISTS "admins_manage_pupil_eligibility" ON public.activity_pupil_eligibility;
CREATE POLICY "admins_manage_pupil_eligibility" ON public.activity_pupil_eligibility
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_pupil_eligibility.activity_id
        AND public.is_admin_of_school(a.school_id)
    )
  );

-- ─── orders + child tables (order_items / payments / refunds / emails) ────────
DROP POLICY IF EXISTS "admins_read_all_orders" ON public.orders;
CREATE POLICY "admins_read_all_orders" ON public.orders
  FOR SELECT USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_update_orders" ON public.orders;
CREATE POLICY "admins_update_orders" ON public.orders
  FOR UPDATE USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_read_all_order_items" ON public.order_items;
CREATE POLICY "admins_read_all_order_items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_order_items" ON public.order_items;
CREATE POLICY "admins_manage_order_items" ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_read_all_payments" ON public.payments;
CREATE POLICY "admins_read_all_payments" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_payments" ON public.payments;
CREATE POLICY "admins_manage_payments" ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_read_all_refunds" ON public.refunds;
CREATE POLICY "admins_read_all_refunds" ON public.refunds
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_refunds" ON public.refunds;
CREATE POLICY "admins_manage_refunds" ON public.refunds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_email_notifs" ON public.email_notifications;
CREATE POLICY "admins_manage_email_notifs" ON public.email_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = email_notifications.order_id AND public.is_admin_of_school(o.school_id))
  );

-- ─── teachers / payment_links / attendance / audit_logs ──────────────────────
DROP POLICY IF EXISTS "admins_manage_teachers" ON public.teachers;
CREATE POLICY "admins_manage_teachers" ON public.teachers
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_payment_links" ON public.payment_links;
CREATE POLICY "admins_manage_payment_links" ON public.payment_links
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_attendance_sessions" ON public.attendance_sessions;
CREATE POLICY "admins_manage_attendance_sessions" ON public.attendance_sessions
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_attendance_records" ON public.attendance_records;
CREATE POLICY "admins_manage_attendance_records" ON public.attendance_records
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
  FOR SELECT USING (school_id IS NOT NULL AND public.is_admin_of_school(school_id));
