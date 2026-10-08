/**
 * Supabase database type definitions.
 * Generated manually for the POC; in production run:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * Row interfaces are defined as standalone types BEFORE the Database interface
 * to avoid circular type references that cause Supabase query inference to return `never`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'school_admin' | 'finance_admin' | 'teacher' | 'parent'

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'fully_refunded'
  | 'payment_failed'
  | 'expired'
  | 'cancelled'

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'partially_refunded'

export type RefundStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled'

export type VerificationStatus =
  // SRS §9.2 spec-compliant values (added in migration 011)
  | 'verified_link' // registered parent selected from verified linked-child list
  | 'verified_code' // guest matched via pupil payment code (AT-004)
  | 'manual_review' // guest manual entry — MANUAL_RECONCILIATION_REQUIRED (AT-005)
  | 'manually_matched' // admin resolved a manual entry to a known pupil (FR-ADM-005)
  // Legacy values retained for backward compatibility with pre-011 rows
  | 'verified'
  | 'manual'
  | 'unverified'

export type PublicationStatus = 'draft' | 'published' | 'closed' | 'archived'

export type PricingModel = 'per_term' | 'per_month' | 'per_session'

export type PaymentProvider = 'stripe' | 'revolut'

export type AttendanceStatus = 'present' | 'absent' | 'late'

export type OrderSource = 'registered_parent' | 'guest_code' | 'guest_manual'

export type EmailStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export type EmailType =
  | 'payer_receipt'
  | 'school_notification'
  | 'deposit_receipt'
  | 'refund_notice'
  | 'subscription_payment_failed'
  | 'subscription_ended'
  | 'parent_message'
  | 'time_off_requested'
  | 'time_off_reviewed'
  | 'meeting_booked'
  | 'meeting_cancelled'
  | 'assignment_uploaded'

export type SubscriptionPlan = 'free' | 'pro' | 'school'

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'incomplete'

export type AuditAction =
  | 'student.created'
  | 'student.updated'
  | 'student.deactivated'
  | 'student.pupil_code_regenerated'
  | 'parent_student.linked'
  | 'parent_student.unlinked'
  | 'parent_link_request.submitted'
  | 'parent_link_request.approved'
  | 'parent_link_request.rejected'
  | 'activity.created'
  | 'activity.updated'
  | 'activity.published'
  | 'activity.archived'
  | 'activity.closed'
  | 'class.updated'
  | 'teacher.created'
  | 'teacher.updated'
  | 'teacher.deactivated'
  | 'payment_link.created'
  | 'payment_link.updated'
  | 'payment_link.deactivated'
  | 'order.created'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.expired'
  | 'refund.requested'
  | 'refund.completed'
  | 'refund.failed'
  | 'reconciliation.resolved'
  | 'email.resent'
  | 'activity.email_sent'
  | 'programme.created'
  | 'programme.updated'
  | 'programme.published'
  | 'programme.closed'
  | 'programme.archived'
  | 'report.exported'
  | 'role.changed'
  | 'settings.updated'
  | 'attendance.session_created'
  | 'attendance.record_updated'
  | 'time_off.requested'
  | 'time_off.approved'
  | 'time_off.rejected'
  | 'aim.case_created'
  | 'aim.case_updated'
  | 'aim.consent_recorded'
  | 'aim.submitted'
  | 'aim.closed'
  | 'funding.ppsn_revealed'
  | 'funding.chick_revealed'
  | 'invoice.sent'

// ─── Standalone Row Interfaces ────────────────────────────────────────────────
// Defined before Database to avoid circular type references.

export interface SchoolRow {
  id: string
  name: string
  subdomain: string | null
  roll_number: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  county: string | null
  eircode: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  is_active: boolean
  // Stripe Connect (per-school direct-charge account). Null until the school
  // starts onboarding; charges_enabled gates whether parent payments may route
  // to them. See migration 066.
  stripe_connect_account_id: string | null
  stripe_connect_charges_enabled: boolean
  stripe_connect_details_submitted: boolean
  // Per-school Revolut credentials, ENCRYPTED at rest (AES-256-GCM). Null until
  // the school connects its own Revolut Merchant account. See migration 067.
  revolut_api_key_enc: string | null
  revolut_webhook_secret_enc: string | null
  created_at: string
  updated_at: string
}

export interface ProfileRow {
  id: string
  school_id: string | null
  email: string
  first_name: string
  last_name: string
  phone: string | null
  email_verified: boolean
  sms_opt_out: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RoleRow {
  id: string
  name: UserRole
  display_name: string
  description: string | null
  created_at: string
}

export interface PermissionRow {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface RolePermissionRow {
  role_id: string
  permission_id: string
  created_at: string
}

export interface UserRoleRow {
  id: string
  user_id: string
  role_id: string
  school_id: string
  granted_by: string | null
  created_at: string
}

export interface SchoolSettingRow {
  id: string
  school_id: string
  key: string
  value: string
  description: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface TeacherRow {
  id: string
  school_id: string
  first_name: string
  last_name: string
  display_name: string | null
  email: string | null
  profile_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClassRow {
  id: string
  school_id: string
  name: string
  display_order: number
  teacher_id: string | null
  academic_year: string | null
  capacity: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PaymentLinkRow {
  id: string
  school_id: string
  activity_id: string
  created_by: string | null
  label: string
  public_token: string
  opens_at: string | null
  expires_at: string | null
  max_uses: number | null
  use_count: number
  visit_count: number
  completed_order_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StudentRow {
  id: string
  school_id: string
  first_name: string
  last_name: string
  class_id: string
  pupil_payment_code: string
  is_active: boolean
  parent_mobile: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  allergies: string | null
  dietary_needs: string | null
  medical_conditions: string | null
  medication_consent: boolean
  medication_notes: string | null
  session: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'OTHER' | null
  leaving_date: string | null
  created_at: string
  updated_at: string
}

export interface ParentStudentLinkRow {
  id: string
  parent_id: string
  student_id: string
  school_id: string
  relationship: string | null
  linked_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ParentLinkRequestRow {
  id: string
  parent_id: string
  student_id: string
  school_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export interface ActivityRow {
  id: string
  school_id: string
  name: string
  description: string | null
  amount_cents: number
  currency: string
  accounting_code: string | null
  opens_at: string | null
  closes_at: string | null
  publication_status: PublicationStatus
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ActivityClassEligibilityRow {
  activity_id: string
  class_id: string
  created_at: string
}

export interface ActivityPupilEligibilityRow {
  activity_id: string
  student_id: string
  created_at: string
}

export interface ProgrammeRow {
  id: string
  school_id: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  pricing_model: PricingModel
  days_of_week: string[]
  session_time: string | null
  term_start: string | null
  term_end: string | null
  max_enrolments: number | null
  publication_status: PublicationStatus
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProgrammeClassEligibilityRow {
  programme_id: string
  class_id: string
  created_at: string
}

export interface OrderRow {
  id: string
  school_id: string
  order_reference: string
  payer_profile_id: string | null
  guest_payer_name: string | null
  guest_payer_email: string | null
  currency: string
  subtotal_cents: number
  total_cents: number
  amount_paid_cents: number
  payment_type: 'full' | 'installment'
  status: OrderStatus
  source: OrderSource
  correlation_id: string | null
  payment_link_id: string | null
  acquisition_source: string | null
  source_reference: string | null
  created_at: string
  updated_at: string
}

export interface OrderItemRow {
  id: string
  order_id: string
  student_id: string | null
  manual_student_first_name: string | null
  manual_student_last_name: string | null
  class_id: string
  student_name_snapshot: string
  class_name_snapshot: string
  teacher_name_snapshot: string | null
  activity_id: string | null
  activity_name_snapshot: string | null
  programme_id: string | null
  programme_name_snapshot: string | null
  unit_amount_cents: number
  item_reference: string
  verification_status: VerificationStatus
  created_at: string
}

export interface PaymentRow {
  id: string
  order_id: string
  payment_reference: string
  provider: PaymentProvider
  provider_checkout_session_id: string | null
  provider_payment_intent_id: string | null
  provider_order_id: string | null
  amount_cents: number
  refunded_amount_cents: number
  currency: string
  status: PaymentStatus
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface RefundRow {
  id: string
  payment_id: string
  order_id: string
  refund_reference: string
  amount_cents: number
  currency: string
  reason: string | null
  status: RefundStatus
  provider_refund_id: string | null
  requested_by: string | null
  created_at: string
  updated_at: string
}

export interface WebhookEventRow {
  id: string
  provider: PaymentProvider
  event_id: string
  event_type: string
  payload: Json
  processed: boolean
  processed_at: string | null
  error: string | null
  created_at: string
}

export interface EmailNotificationRow {
  id: string
  order_id: string | null
  school_id: string | null
  type: EmailType
  recipient_email: string
  subject: string
  status: EmailStatus
  provider_message_id: string | null
  failure_details: string | null
  retry_count: number
  last_attempted_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type ParentMessageAudience = 'class' | 'student' | 'school'
export type ParentMessageSenderRole = 'admin' | 'teacher'

export interface ParentMessageRow {
  id: string
  school_id: string
  sender_id: string | null
  sender_role: ParentMessageSenderRole
  audience_type: ParentMessageAudience
  class_id: string | null
  student_id: string | null
  subject: string
  body: string
  recipient_count: number
  created_at: string
}

export interface ParentMessageRecipientRow {
  id: string
  message_id: string
  parent_id: string
  school_id: string
  read_at: string | null
  created_at: string
}

export interface MeetingSlotRow {
  id: string
  school_id: string
  teacher_id: string
  class_id: string | null
  slot_date: string
  start_time: string
  end_time: string
  booked_parent_id: string | null
  booked_student_id: string | null
  booked_at: string | null
  created_at: string
  updated_at: string
}

export type TimeOffStatus = 'pending' | 'approved' | 'rejected'

export interface TimeOffRequestRow {
  id: string
  school_id: string
  teacher_id: string
  start_date: string
  end_date: string
  reason: string | null
  status: TimeOffStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

export type AssignmentFileKind = 'image' | 'pdf'

export interface StudentAssignmentRow {
  id: string
  school_id: string
  student_id: string
  /** Profile id of the parent who uploaded it; null if that profile is removed. */
  uploaded_by: string | null
  title: string | null
  /** Object path within the private `student-assignments` bucket. */
  file_path: string
  file_kind: AssignmentFileKind
  content_type: string
  file_size_bytes: number
  original_filename: string | null
  created_at: string
}

export type DocumentCategory = 'test_result' | 'report_card'

/** A staff-uploaded document (test result / report card) a parent can view. */
export interface StudentDocumentRow {
  id: string
  school_id: string
  student_id: string
  /** Profile id of the staff member who uploaded it; null if that profile is removed. */
  uploaded_by: string | null
  category: DocumentCategory
  title: string | null
  /** Optional free-text term label, e.g. "Term 1 2025/26" (mainly report cards). */
  term: string | null
  file_path: string
  file_kind: AssignmentFileKind
  content_type: string
  file_size_bytes: number
  original_filename: string | null
  created_at: string
}

export type PermissionSlipAudience = 'class' | 'school'
export type PermissionSlipCreatorRole = 'admin' | 'teacher'

export interface PermissionSlipRow {
  id: string
  school_id: string
  created_by: string | null
  created_by_role: PermissionSlipCreatorRole
  title: string
  description: string | null
  due_date: string | null
  audience_type: PermissionSlipAudience
  class_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PermissionSlipResponseRow {
  id: string
  slip_id: string
  student_id: string
  school_id: string
  parent_id: string | null
  consent: boolean
  note: string | null
  responded_at: string
  updated_at: string
}

/** An email-verified "create your portal" lead (platform-level, pre-tenant). */
export interface PortalSignupRow {
  id: string
  email: string
  contact_name: string | null
  school_name: string | null
  token: string
  verified_at: string | null
  requested_at: string
  created_at: string
  updated_at: string
}

export interface AuditLogRow {
  id: string
  school_id: string | null
  actor_id: string | null
  actor_email: string | null
  action: AuditAction
  resource_type: string
  resource_id: string | null
  metadata: Json | null
  correlation_id: string | null
  ip_address: string | null
  created_at: string
}

export interface AttendanceSessionRow {
  id: string
  school_id: string
  class_id: string
  teacher_id: string | null
  session_date: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionRow {
  id: string
  school_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_ends_at: string | null
  /** SMS entitlement (€44.99 Pro+SMS tier). Set from the Stripe price at sync time. */
  sms_enabled: boolean
  created_at: string
  updated_at: string
}

export interface AttendanceRecordRow {
  id: string
  session_id: string
  student_id: string
  school_id: string
  status: AttendanceStatus
  note: string | null
  /** Parent-entered reason for an absence/late; separate from the teacher `note`. */
  parent_reason: string | null
  parent_reason_at: string | null
  parent_reason_by: string | null
  created_at: string
  updated_at: string
}

// ─── Database Schema ──────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow
        // Stripe Connect columns have DB defaults (false) / are nullable, so they
        // are optional on insert.
        Insert: Omit<
          SchoolRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'stripe_connect_account_id'
          | 'stripe_connect_charges_enabled'
          | 'stripe_connect_details_submitted'
          | 'revolut_api_key_enc'
          | 'revolut_webhook_secret_enc'
        > & {
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_details_submitted?: boolean
          revolut_api_key_enc?: string | null
          revolut_webhook_secret_enc?: string | null
        }
        Update: Partial<Omit<SchoolRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      profiles: {
        Row: ProfileRow
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProfileRow, 'created_at' | 'updated_at'>>
        Relationships: []
      }
      roles: {
        Row: RoleRow
        Insert: Omit<RoleRow, 'id' | 'created_at'>
        Update: Partial<Omit<RoleRow, 'id' | 'created_at'>>
        Relationships: []
      }
      permissions: {
        Row: PermissionRow
        Insert: Omit<PermissionRow, 'id' | 'created_at'>
        Update: Partial<Omit<PermissionRow, 'id' | 'created_at'>>
        Relationships: []
      }
      role_permissions: {
        Row: RolePermissionRow
        Insert: Omit<RolePermissionRow, 'created_at'>
        Update: Partial<Omit<RolePermissionRow, 'created_at'>>
        Relationships: []
      }
      user_roles: {
        Row: UserRoleRow
        Insert: Omit<UserRoleRow, 'id' | 'created_at'>
        Update: Partial<Omit<UserRoleRow, 'id' | 'created_at'>>
        Relationships: []
      }
      school_settings: {
        Row: SchoolSettingRow
        Insert: Omit<SchoolSettingRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SchoolSettingRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      teachers: {
        Row: TeacherRow
        Insert: Omit<TeacherRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TeacherRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      classes: {
        Row: ClassRow
        Insert: Omit<ClassRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ClassRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      payment_links: {
        Row: PaymentLinkRow
        Insert: Omit<
          PaymentLinkRow,
          'id' | 'created_at' | 'updated_at' | 'public_token' | 'use_count'
        >
        Update: Partial<Omit<PaymentLinkRow, 'id' | 'created_at' | 'updated_at' | 'public_token'>>
        Relationships: []
      }
      students: {
        Row: StudentRow
        Insert: Omit<StudentRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StudentRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      parent_student_links: {
        Row: ParentStudentLinkRow
        Insert: Omit<ParentStudentLinkRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ParentStudentLinkRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      parent_link_requests: {
        Row: ParentLinkRequestRow
        Insert: Omit<ParentLinkRequestRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ParentLinkRequestRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      activities: {
        Row: ActivityRow
        Insert: Omit<ActivityRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ActivityRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      activity_class_eligibility: {
        Row: ActivityClassEligibilityRow
        Insert: Omit<ActivityClassEligibilityRow, 'created_at'>
        Update: Partial<Omit<ActivityClassEligibilityRow, 'created_at'>>
        Relationships: []
      }
      activity_pupil_eligibility: {
        Row: ActivityPupilEligibilityRow
        Insert: Omit<ActivityPupilEligibilityRow, 'created_at'>
        Update: Partial<Omit<ActivityPupilEligibilityRow, 'created_at'>>
        Relationships: []
      }
      programmes: {
        Row: ProgrammeRow
        Insert: Omit<ProgrammeRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProgrammeRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      programme_class_eligibility: {
        Row: ProgrammeClassEligibilityRow
        Insert: Omit<ProgrammeClassEligibilityRow, 'created_at'>
        Update: Partial<Omit<ProgrammeClassEligibilityRow, 'created_at'>>
        Relationships: []
      }
      orders: {
        Row: OrderRow
        Insert: Omit<OrderRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<OrderRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      order_items: {
        Row: OrderItemRow
        Insert: Omit<OrderItemRow, 'id' | 'created_at'>
        Update: Partial<Omit<OrderItemRow, 'id' | 'created_at'>>
        Relationships: []
      }
      payments: {
        Row: PaymentRow
        Insert: Omit<PaymentRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PaymentRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      refunds: {
        Row: RefundRow
        Insert: Omit<RefundRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RefundRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      webhook_events: {
        Row: WebhookEventRow
        Insert: Omit<WebhookEventRow, 'id' | 'created_at'>
        Update: Partial<Omit<WebhookEventRow, 'id' | 'created_at'>>
        Relationships: []
      }
      email_notifications: {
        Row: EmailNotificationRow
        Insert: Omit<EmailNotificationRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EmailNotificationRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      audit_logs: {
        Row: AuditLogRow
        Insert: Omit<AuditLogRow, 'id' | 'created_at'>
        Update: never
        Relationships: []
      }
      parent_messages: {
        Row: ParentMessageRow
        Insert: Omit<ParentMessageRow, 'id' | 'created_at'>
        Update: never
        Relationships: []
      }
      parent_message_recipients: {
        Row: ParentMessageRecipientRow
        Insert: Omit<ParentMessageRecipientRow, 'id' | 'created_at'>
        Update: Partial<Pick<ParentMessageRecipientRow, 'read_at'>>
        Relationships: []
      }
      time_off_requests: {
        Row: TimeOffRequestRow
        Insert: Omit<TimeOffRequestRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TimeOffRequestRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      meeting_slots: {
        Row: MeetingSlotRow
        Insert: Omit<MeetingSlotRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MeetingSlotRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      student_assignments: {
        Row: StudentAssignmentRow
        Insert: Omit<StudentAssignmentRow, 'id' | 'created_at'>
        Update: Partial<Omit<StudentAssignmentRow, 'id' | 'created_at'>>
        Relationships: []
      }
      student_documents: {
        Row: StudentDocumentRow
        Insert: Omit<StudentDocumentRow, 'id' | 'created_at'>
        Update: Partial<Omit<StudentDocumentRow, 'id' | 'created_at'>>
        Relationships: []
      }
      permission_slips: {
        Row: PermissionSlipRow
        Insert: Omit<PermissionSlipRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PermissionSlipRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      permission_slip_responses: {
        Row: PermissionSlipResponseRow
        Insert: Omit<PermissionSlipResponseRow, 'id' | 'responded_at' | 'updated_at'>
        Update: Partial<Omit<PermissionSlipResponseRow, 'id' | 'responded_at' | 'updated_at'>>
        Relationships: []
      }
      portal_signups: {
        Row: PortalSignupRow
        Insert: Omit<PortalSignupRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PortalSignupRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      attendance_sessions: {
        Row: AttendanceSessionRow
        Insert: Omit<AttendanceSessionRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AttendanceSessionRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      attendance_records: {
        Row: AttendanceRecordRow
        Insert: Omit<AttendanceRecordRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AttendanceRecordRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      subscriptions: {
        // sms_enabled has a DB default (false) — optional on insert.
        Row: SubscriptionRow
        Insert: Omit<SubscriptionRow, 'id' | 'created_at' | 'updated_at' | 'sms_enabled'> & {
          sms_enabled?: boolean
        }
        Update: Partial<Omit<SubscriptionRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      generate_order_reference: {
        Args: Record<string, never>
        Returns: string
      }
      generate_payment_reference: {
        Args: Record<string, never>
        Returns: string
      }
      generate_item_reference: {
        Args: Record<string, never>
        Returns: string
      }
      generate_refund_reference: {
        Args: Record<string, never>
        Returns: string
      }
      generate_pupil_code: {
        Args: { p_prefix?: string }
        Returns: string
      }
      get_user_permissions: {
        Args: Record<string, unknown>
        Returns: string[]
      }
      get_user_role: {
        Args: Record<string, unknown>
        Returns: string
      }
      user_has_permission: {
        Args: Record<string, unknown>
        Returns: boolean
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      order_status: OrderStatus
      payment_status: PaymentStatus
      refund_status: RefundStatus
      verification_status: VerificationStatus
      publication_status: PublicationStatus
      payment_provider: PaymentProvider
      order_source: OrderSource
      email_status: EmailStatus
      email_type: EmailType
      attendance_status: AttendanceStatus
      subscription_plan: SubscriptionPlan
      subscription_status: SubscriptionStatus
    }
  }
}

// ─── Convenience Row Aliases ──────────────────────────────────────────────────
// These now reference the standalone interfaces above — no circular refs.

export type School = SchoolRow
export type Profile = ProfileRow
export type Role = RoleRow
export type Permission = PermissionRow
export type Teacher = TeacherRow
export type PaymentLink = PaymentLinkRow
export type Class = ClassRow
export type Student = StudentRow
export type ParentStudentLink = ParentStudentLinkRow
export type ParentLinkRequest = ParentLinkRequestRow
export type Activity = ActivityRow
export type ActivityEligibility = ActivityClassEligibilityRow
export type ActivityPupilEligibility = ActivityPupilEligibilityRow
export type Programme = ProgrammeRow
export type ProgrammeClassEligibility = ProgrammeClassEligibilityRow
export type Order = OrderRow
export type OrderItem = OrderItemRow
export type Payment = PaymentRow
export type Refund = RefundRow
export type WebhookEvent = WebhookEventRow
export type EmailNotification = EmailNotificationRow
export type AuditLog = AuditLogRow
export type SchoolSetting = SchoolSettingRow
export type AttendanceSession = AttendanceSessionRow
export type AttendanceRecord = AttendanceRecordRow
export type Subscription = SubscriptionRow
