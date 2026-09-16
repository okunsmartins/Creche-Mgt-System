'use server'

import { headers } from 'next/headers'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { getViewerSchoolId } from '@/lib/tenant/server'
import { createCorrelationId } from '@/lib/utils'
import { checkRateLimit } from '@/lib/rateLimit'
import {
  lookupPupilSchema,
  guestCodeOrderSchema,
  guestManualOrderSchema,
  parentOrderSchema,
  type LookupPupilState,
  type OrderActionState,
} from './schemas'
import type { ActivityRow, ProgrammeRow, AuditAction } from '@/types/database'

// ─── Teacher display name helper ─────────────────────────────────────────────
// Uses display_name if set (e.g. "Ms Kelly"); falls back to first + last name.

function resolveTeacherDisplayName(
  teacher: { display_name: string | null; first_name: string; last_name: string } | null,
): string | null {
  if (!teacher) return null
  return teacher.display_name ?? `${teacher.first_name} ${teacher.last_name}`
}

// ─── Payment link use count helper ───────────────────────────────────────────

type AdminClientType = ReturnType<typeof createSupabaseAdminClient>

async function incrementPaymentLinkUseCount(
  adminClient: AdminClientType,
  paymentLinkId: string,
): Promise<void> {
  try {
    const { data } = await adminClient
      .from('payment_links')
      .select('use_count')
      .eq('id', paymentLinkId)
      .single()
    if (data) {
      await adminClient
        .from('payment_links')
        .update({ use_count: (data as { use_count: number }).use_count + 1 })
        .eq('id', paymentLinkId)
    }
  } catch (err) {
    logger.warn('payment_link_use_count_increment_failed', {
      paymentLinkId,
      error: err instanceof Error ? err.message : 'Unknown',
    })
  }
}

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function audit(params: {
  schoolId: string
  actorId?: string | undefined
  actorEmail: string
  action: AuditAction
  resourceType: string
  resourceId?: string | undefined
  metadata?: Record<string, string | number | boolean | null> | undefined
  correlationId?: string | undefined
}): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('audit_logs').insert({
    school_id: params.schoolId,
    actor_id: params.actorId ?? null,
    actor_email: params.actorEmail,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    correlation_id: params.correlationId ?? null,
    ip_address: null,
  })
  if (error) {
    logger.error('audit_log_failed', { action: params.action, error: error.message })
  }
}

// ─── Shared: Validate activity is open for payment (FR-ACT-005) ───────────────

type ActivityForOrder = Pick<
  ActivityRow,
  | 'id'
  | 'name'
  | 'amount_cents'
  | 'currency'
  | 'school_id'
  | 'publication_status'
  | 'is_active'
  | 'opens_at'
  | 'closes_at'
>

function validateActivityOpen(activity: ActivityForOrder): string | null {
  if (activity.publication_status !== 'published' || !activity.is_active) {
    return 'This activity is not currently available for payment.'
  }
  const now = new Date()
  if (activity.opens_at && new Date(activity.opens_at) > now) {
    return 'This activity has not opened for payment yet.'
  }
  if (activity.closes_at && new Date(activity.closes_at) <= now) {
    return 'The payment deadline for this activity has passed.'
  }
  return null
}

// ─── Lookup Pupil by Payment Code ─────────────────────────────────────────────
// Anti-enumeration: returns the same generic message for not-found and inactive.
// Returns only display info (first name + class) — never the student ID.

export async function lookupPupilAction(
  _prev: LookupPupilState,
  formData: FormData,
): Promise<LookupPupilState> {
  // NFR-SEC-005: Rate limit to prevent pupil code enumeration attacks
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'
  const { allowed } = checkRateLimit(`lookup:${ip}`)
  if (!allowed) {
    return { error: 'Too many requests. Please wait a moment before trying again.' }
  }

  const result = lookupPupilSchema.safeParse({ pupilCode: formData.get('pupilCode') })
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return { error: fe.pupilCode?.[0] ?? 'Invalid pupil code' }
  }

  const { pupilCode } = result.data
  const adminClient = createSupabaseAdminClient()
  // Resolve the school the SAME way the guest pages do (getViewerSchoolId):
  // the /s/<sub> subdomain/cookie, else the signed-in user's own school. There is
  // no default fallback — guessing would attach the order to the WRONG school — so
  // a null here means "no school chosen" and we stop rather than proceed.
  const schoolId = await getViewerSchoolId()
  if (!schoolId) return { error: 'Please choose your school first, then try again.' }

  type StudentLookup = {
    first_name: string
    is_active: boolean
    classes: { name: string } | null
  }

  const { data: student } = await adminClient
    .from('students')
    .select('first_name, is_active, classes(name)')
    .eq('pupil_payment_code', pupilCode)
    .eq('school_id', schoolId)
    .single()

  const stu = student as StudentLookup | null

  if (!stu || !stu.is_active) {
    return {
      error:
        "We couldn't find a child with that code. Please check the code and try again, or enter your child's details manually below.",
    }
  }

  return {
    success: true,
    studentFirstName: stu.first_name,
    className: stu.classes?.name ?? 'Unknown class',
  }
}

// ─── Create Guest Order (Pupil Code Path) ─────────────────────────────────────
// Price is read from the DB — never trusted from the client.
// Pupil code is re-validated server-side regardless of prior lookup result.
// activityIds is a JSON string of UUID array (from the basket hidden input).
// Returns { orderId } — client handles redirect and basket clearing.

export async function createGuestCodeOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const result = guestCodeOrderSchema.safeParse({
    payerName: formData.get('payerName'),
    payerEmail: formData.get('payerEmail'),
    pupilCode: formData.get('pupilCode'),
    basket: formData.get('basket'),
  })
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        payerName: fe.payerName?.[0],
        payerEmail: fe.payerEmail?.[0],
        pupilCode: fe.pupilCode?.[0],
        basket: fe.basket?.[0],
      },
    }
  }

  const { payerName, payerEmail, pupilCode, basket } = result.data
  const activityItems = basket.filter((i) => i.kind === 'activity')
  const programmeItems = basket.filter((i) => i.kind === 'programme')
  const activityIds = activityItems.map((i) => i.activityId)
  const programmeIds = programmeItems.map((i) => i.programmeId)

  const paymentLinkId =
    typeof formData.get('paymentLinkId') === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      formData.get('paymentLinkId') as string,
    )
      ? (formData.get('paymentLinkId') as string)
      : null
  const adminClient = createSupabaseAdminClient()
  // Resolve the school the SAME way the guest pages do (getViewerSchoolId):
  // the /s/<sub> subdomain/cookie, else the signed-in user's own school. There is
  // no default fallback — guessing would attach the order to the WRONG school — so
  // a null here means "no school chosen" and we stop rather than proceed.
  const schoolId = await getViewerSchoolId()
  if (!schoolId) return { error: 'Please choose your school first, then try again.' }

  // Re-validate pupil code (anti-enumeration: same message for not-found and inactive)
  type StudentForOrder = {
    id: string
    first_name: string
    last_name: string
    class_id: string
    is_active: boolean
    classes: {
      name: string
      teacher_id: string | null
      teachers: { display_name: string | null; first_name: string; last_name: string } | null
    } | null
  }

  const { data: studentData } = await adminClient
    .from('students')
    .select(
      'id, first_name, last_name, class_id, is_active, classes(name, teacher_id, teachers(display_name, first_name, last_name))',
    )
    .eq('pupil_payment_code', pupilCode)
    .eq('school_id', schoolId)
    .single()

  const student = studentData as StudentForOrder | null
  if (!student || !student.is_active) {
    return { error: 'Pupil code not found. Please check the code and try again.' }
  }

  // Batch-fetch all activities and validate each (FR-ACT-005)
  const activityMap = new Map<string, ActivityForOrder>()
  if (activityIds.length > 0) {
    const { data: activitiesData } = await adminClient
      .from('activities')
      .select(
        'id, name, amount_cents, currency, school_id, publication_status, is_active, opens_at, closes_at',
      )
      .in('id', activityIds)
      .eq('school_id', schoolId)

    for (const a of (activitiesData as ActivityForOrder[] | null) ?? []) {
      activityMap.set(a.id, a)
    }

    for (const activityId of activityIds) {
      const activity = activityMap.get(activityId)
      if (!activity) return { error: 'One or more activities were not found.' }
      const err = validateActivityOpen(activity)
      if (err) return { error: err }
    }

    // Check class eligibility for all activities
    const { data: classEligibilityData } = await adminClient
      .from('activity_class_eligibility')
      .select('activity_id')
      .in('activity_id', activityIds)
      .eq('class_id', student.class_id)

    const classEligibleIds = new Set(
      ((classEligibilityData as { activity_id: string }[] | null) ?? []).map((e) => e.activity_id),
    )

    // Also check individual pupil eligibility (union with class eligibility)
    const notClassEligible = activityIds.filter((id) => !classEligibleIds.has(id))
    const pupilEligibleIds = new Set<string>()
    if (notClassEligible.length > 0) {
      const { data: pupilEligibilityData } = await adminClient
        .from('activity_pupil_eligibility')
        .select('activity_id')
        .in('activity_id', notClassEligible)
        .eq('student_id', student.id)

      for (const pe of (pupilEligibilityData as { activity_id: string }[] | null) ?? []) {
        pupilEligibleIds.add(pe.activity_id)
      }
    }

    for (const activityId of activityIds) {
      if (!classEligibleIds.has(activityId) && !pupilEligibleIds.has(activityId)) {
        const activity = activityMap.get(activityId)
        return { error: `"${activity?.name ?? 'An activity'}" is not available for your child.` }
      }
    }

    // FR-ORD-007: batch duplicate detection for activities
    const { data: existingItemsData } = await adminClient
      .from('order_items')
      .select('activity_id, order_id')
      .eq('student_id', student.id)
      .in('activity_id', activityIds)

    if (existingItemsData && existingItemsData.length > 0) {
      type ExistingItem = { activity_id: string; order_id: string }
      const orderIds = [...new Set((existingItemsData as ExistingItem[]).map((i) => i.order_id))]
      const { data: activeOrders } = await adminClient
        .from('orders')
        .select('id')
        .in('id', orderIds)
        .in('status', ['paid', 'pending_payment'])
        .limit(1)

      if (activeOrders && activeOrders.length > 0) {
        return {
          error:
            'An order for this child and one or more selected activities is already active or paid.',
        }
      }
    }
  }

  // Batch-fetch and validate programmes
  const programmeMap = new Map<string, ProgrammeForOrder>()
  if (programmeIds.length > 0) {
    const { data: programmesData } = await adminClient
      .from('programmes')
      .select(
        'id, name, price_cents, currency, school_id, publication_status, is_active, max_enrolments',
      )
      .in('id', programmeIds)
      .eq('school_id', schoolId)

    for (const p of (programmesData as ProgrammeForOrder[] | null) ?? []) {
      programmeMap.set(p.id, p)
    }

    for (const programmeId of programmeIds) {
      const programme = programmeMap.get(programmeId)
      if (!programme) return { error: 'One or more programmes were not found.' }
      const err = validateProgrammeOpen(programme)
      if (err) return { error: err }
    }

    // Class eligibility for programmes
    const { data: progEligData } = await adminClient
      .from('programme_class_eligibility')
      .select('programme_id')
      .in('programme_id', programmeIds)
      .eq('class_id', student.class_id)

    const progEligibleIds = new Set(
      ((progEligData as { programme_id: string }[] | null) ?? []).map((e) => e.programme_id),
    )

    for (const programmeId of programmeIds) {
      if (!progEligibleIds.has(programmeId)) {
        const programme = programmeMap.get(programmeId)
        return {
          error: `"${programme?.name ?? 'A programme'}" is not available for your child's class.`,
        }
      }
    }

    // Duplicate detection for programmes
    const { data: existingProgItems } = await adminClient
      .from('order_items')
      .select('programme_id, order_id')
      .eq('student_id', student.id)
      .in('programme_id', programmeIds)

    if (existingProgItems && existingProgItems.length > 0) {
      type ExistingProgItem = { programme_id: string | null; order_id: string }
      const orderIds = [
        ...new Set((existingProgItems as ExistingProgItem[]).map((i) => i.order_id)),
      ]
      const { data: activeOrders } = await adminClient
        .from('orders')
        .select('id')
        .in('id', orderIds)
        .in('status', ['paid', 'pending_payment'])
        .limit(1)

      if (activeOrders && activeOrders.length > 0) {
        return {
          error:
            'An enrolment for this child and one or more selected programmes is already active or paid.',
        }
      }
    }

    // Enrolment cap check
    for (const programmeId of programmeIds) {
      const programme = programmeMap.get(programmeId)!
      if (programme.max_enrolments === null) continue
      const { count } = await adminClient
        .from('order_items')
        // Count via an inner join on the parent order rather than fetching every
        // paid/pending order id first: that read was unbounded (all schools) and
        // PostgREST caps returned rows, so past the cap the id list truncated and
        // the enrolment count silently under-reported — letting a programme
        // over-enrol past max_enrolments. programme_id is school-unique, so this
        // stays correctly scoped.
        .select('id, orders!inner(status)', { count: 'exact', head: true })
        .eq('programme_id', programmeId)
        .in('orders.status', ['paid', 'pending_payment'])

      if ((count ?? 0) >= programme.max_enrolments) {
        return { error: `"${programme.name}" has reached its maximum enrolment.` }
      }
    }
  }

  // Server calculates total — never uses client-supplied amounts
  const activityTotal = activityIds.reduce(
    (sum, id) => sum + (activityMap.get(id)?.amount_cents ?? 0),
    0,
  )
  const programmeTotal = programmeIds.reduce(
    (sum, id) => sum + (programmeMap.get(id)?.price_cents ?? 0),
    0,
  )
  const totalCents = activityTotal + programmeTotal

  const currency =
    (activityIds.length > 0
      ? activityMap.get(activityIds[0] as string)?.currency
      : programmeMap.get(programmeIds[0] as string)?.currency) ?? 'EUR'

  const correlationId = createCorrelationId()
  const teacherName = resolveTeacherDisplayName(student.classes?.teachers ?? null)

  const { data: orderData, error: orderError } = await adminClient
    .from('orders')
    .insert({
      school_id: schoolId,
      guest_payer_name: payerName,
      guest_payer_email: payerEmail,
      currency,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      status: 'draft' as const,
      source: 'guest_code' as const,
      correlation_id: correlationId,
      payment_link_id: paymentLinkId,
      acquisition_source: paymentLinkId ? 'payment_link' : null,
    })
    .select('id, order_reference')
    .single()

  if (orderError || !orderData) {
    logger.error('create_order_failed', { error: orderError?.message })
    return { error: 'Could not create your order. Please try again.' }
  }

  const { id: orderId, order_reference } = orderData as { id: string; order_reference: string }

  for (const activityId of activityIds) {
    const activity = activityMap.get(activityId)!
    const { error: itemError } = await adminClient.from('order_items').insert({
      order_id: orderId,
      student_id: student.id,
      class_id: student.class_id,
      student_name_snapshot: `${student.first_name} ${student.last_name}`,
      class_name_snapshot: student.classes?.name ?? 'Unknown',
      teacher_name_snapshot: teacherName,
      activity_id: activityId,
      activity_name_snapshot: activity.name,
      programme_id: null,
      programme_name_snapshot: null,
      unit_amount_cents: activity.amount_cents,
      verification_status: 'verified_code' as const,
    })

    if (itemError) {
      logger.error('create_order_item_failed', { orderId, error: itemError.message })
      await adminClient.from('orders').delete().eq('id', orderId)
      return { error: 'Could not create your order. Please try again.' }
    }
  }

  for (const programmeId of programmeIds) {
    const programme = programmeMap.get(programmeId)!
    const { error: itemError } = await adminClient.from('order_items').insert({
      order_id: orderId,
      student_id: student.id,
      class_id: student.class_id,
      student_name_snapshot: `${student.first_name} ${student.last_name}`,
      class_name_snapshot: student.classes?.name ?? 'Unknown',
      teacher_name_snapshot: teacherName,
      activity_id: null,
      activity_name_snapshot: null,
      programme_id: programmeId,
      programme_name_snapshot: programme.name,
      unit_amount_cents: programme.price_cents,
      verification_status: 'verified_code' as const,
    })

    if (itemError) {
      logger.error('create_order_item_failed', { orderId, error: itemError.message })
      await adminClient.from('orders').delete().eq('id', orderId)
      return { error: 'Could not create your order. Please try again.' }
    }
  }

  await audit({
    schoolId: schoolId,
    actorEmail: payerEmail,
    action: 'order.created',
    resourceType: 'order',
    resourceId: orderId,
    metadata: {
      order_reference,
      source: 'guest_code',
      activity_count: activityIds.length,
      programme_count: programmeIds.length,
      item_count: basket.length,
      total_cents: totalCents,
    },
    correlationId,
  })

  // Increment payment link use_count (best-effort; never block order creation)
  if (paymentLinkId) {
    await incrementPaymentLinkUseCount(adminClient, paymentLinkId)
  }

  return { orderId }
}

// ─── Create Guest Order (Manual Entry Path) ───────────────────────────────────
// Sets verification_status = 'manual_review' — flagged for school reconciliation.
// activityIds is a JSON string of UUID array (from the basket hidden input).
// Returns { orderId } — client handles redirect and basket clearing.

export async function createGuestManualOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const result = guestManualOrderSchema.safeParse({
    payerName: formData.get('payerName'),
    payerEmail: formData.get('payerEmail'),
    childFirstName: formData.get('childFirstName'),
    childLastName: formData.get('childLastName'),
    childClassId: formData.get('childClassId'),
    basket: formData.get('basket'),
  })
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        payerName: fe.payerName?.[0],
        payerEmail: fe.payerEmail?.[0],
        childFirstName: fe.childFirstName?.[0],
        childLastName: fe.childLastName?.[0],
        childClassId: fe.childClassId?.[0],
        basket: fe.basket?.[0],
      },
    }
  }

  const { payerName, payerEmail, childFirstName, childLastName, childClassId, basket } = result.data
  const activityItems = basket.filter((i) => i.kind === 'activity')
  const programmeItems = basket.filter((i) => i.kind === 'programme')
  const activityIds = activityItems.map((i) => i.activityId)
  const programmeIds = programmeItems.map((i) => i.programmeId)

  const paymentLinkId =
    typeof formData.get('paymentLinkId') === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      formData.get('paymentLinkId') as string,
    )
      ? (formData.get('paymentLinkId') as string)
      : null
  const adminClient = createSupabaseAdminClient()
  // Resolve the school the SAME way the guest pages do (getViewerSchoolId):
  // the /s/<sub> subdomain/cookie, else the signed-in user's own school. There is
  // no default fallback — guessing would attach the order to the WRONG school — so
  // a null here means "no school chosen" and we stop rather than proceed.
  const schoolId = await getViewerSchoolId()
  if (!schoolId) return { error: 'Please choose your school first, then try again.' }

  // Validate the supplied class belongs to this school and is active
  type ClassLookup = {
    id: string
    name: string
    school_id: string
    is_active: boolean
    teachers: { display_name: string | null; first_name: string; last_name: string } | null
  }
  const { data: classData } = await adminClient
    .from('classes')
    .select('id, name, school_id, is_active, teachers(display_name, first_name, last_name)')
    .eq('id', childClassId)
    .eq('school_id', schoolId)
    .single()

  const cls = classData as ClassLookup | null
  if (!cls || !cls.is_active) {
    return {
      error: 'The selected class is no longer available. Please clear your basket and start over.',
    }
  }

  // Batch-fetch and validate all activities (FR-ACT-005)
  const activityMap = new Map<string, ActivityForOrder>()
  if (activityIds.length > 0) {
    const { data: activitiesData } = await adminClient
      .from('activities')
      .select(
        'id, name, amount_cents, currency, school_id, publication_status, is_active, opens_at, closes_at',
      )
      .in('id', activityIds)
      .eq('school_id', schoolId)

    for (const a of (activitiesData as ActivityForOrder[] | null) ?? []) {
      activityMap.set(a.id, a)
    }

    for (const activityId of activityIds) {
      const activity = activityMap.get(activityId)
      if (!activity) return { error: 'One or more activities were not found.' }
      const err = validateActivityOpen(activity)
      if (err) return { error: err }
    }
  }

  // Batch-fetch and validate programmes
  const programmeMap = new Map<string, ProgrammeForOrder>()
  if (programmeIds.length > 0) {
    const { data: programmesData } = await adminClient
      .from('programmes')
      .select(
        'id, name, price_cents, currency, school_id, publication_status, is_active, max_enrolments',
      )
      .in('id', programmeIds)
      .eq('school_id', schoolId)

    for (const p of (programmesData as ProgrammeForOrder[] | null) ?? []) {
      programmeMap.set(p.id, p)
    }

    for (const programmeId of programmeIds) {
      const programme = programmeMap.get(programmeId)
      if (!programme) return { error: 'One or more programmes were not found.' }
      const err = validateProgrammeOpen(programme)
      if (err) return { error: err }
    }

    // Class eligibility for programmes — uses supplied childClassId
    const { data: progEligData } = await adminClient
      .from('programme_class_eligibility')
      .select('programme_id')
      .in('programme_id', programmeIds)
      .eq('class_id', childClassId)

    const progEligibleIds = new Set(
      ((progEligData as { programme_id: string }[] | null) ?? []).map((e) => e.programme_id),
    )

    for (const programmeId of programmeIds) {
      if (!progEligibleIds.has(programmeId)) {
        const programme = programmeMap.get(programmeId)
        return {
          error: `"${programme?.name ?? 'A programme'}" is not available for the selected class.`,
        }
      }
    }

    // Enrolment cap check
    for (const programmeId of programmeIds) {
      const programme = programmeMap.get(programmeId)!
      if (programme.max_enrolments === null) continue
      const { count } = await adminClient
        .from('order_items')
        // Count via an inner join on the parent order rather than fetching every
        // paid/pending order id first: that read was unbounded (all schools) and
        // PostgREST caps returned rows, so past the cap the id list truncated and
        // the enrolment count silently under-reported — letting a programme
        // over-enrol past max_enrolments. programme_id is school-unique, so this
        // stays correctly scoped.
        .select('id, orders!inner(status)', { count: 'exact', head: true })
        .eq('programme_id', programmeId)
        .in('orders.status', ['paid', 'pending_payment'])

      if ((count ?? 0) >= programme.max_enrolments) {
        return { error: `"${programme.name}" has reached its maximum enrolment.` }
      }
    }
  }

  // Server calculates total — never uses client-supplied amounts
  const activityTotal = activityIds.reduce(
    (sum, id) => sum + (activityMap.get(id)?.amount_cents ?? 0),
    0,
  )
  const programmeTotal = programmeIds.reduce(
    (sum, id) => sum + (programmeMap.get(id)?.price_cents ?? 0),
    0,
  )
  const totalCents = activityTotal + programmeTotal

  const currency =
    (activityIds.length > 0
      ? activityMap.get(activityIds[0] as string)?.currency
      : programmeMap.get(programmeIds[0] as string)?.currency) ?? 'EUR'

  const correlationId = createCorrelationId()
  const teacherName = resolveTeacherDisplayName(cls.teachers)

  const { data: orderData, error: orderError } = await adminClient
    .from('orders')
    .insert({
      school_id: schoolId,
      guest_payer_name: payerName,
      guest_payer_email: payerEmail,
      currency,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      status: 'draft' as const,
      source: 'guest_manual' as const,
      correlation_id: correlationId,
      payment_link_id: paymentLinkId,
      acquisition_source: paymentLinkId ? 'payment_link' : null,
    })
    .select('id, order_reference')
    .single()

  if (orderError || !orderData) {
    logger.error('create_order_failed', { error: orderError?.message })
    return { error: 'Could not create your order. Please try again.' }
  }

  const { id: orderId, order_reference } = orderData as { id: string; order_reference: string }

  for (const activityId of activityIds) {
    const activity = activityMap.get(activityId)!
    const { error: itemError } = await adminClient.from('order_items').insert({
      order_id: orderId,
      student_id: null,
      manual_student_first_name: childFirstName,
      manual_student_last_name: childLastName,
      class_id: childClassId,
      student_name_snapshot: `${childFirstName} ${childLastName}`,
      class_name_snapshot: cls.name,
      teacher_name_snapshot: teacherName,
      activity_id: activityId,
      activity_name_snapshot: activity.name,
      programme_id: null,
      programme_name_snapshot: null,
      unit_amount_cents: activity.amount_cents,
      verification_status: 'manual_review' as const,
    })

    if (itemError) {
      logger.error('create_order_item_failed', { orderId, error: itemError.message })
      await adminClient.from('orders').delete().eq('id', orderId)
      return { error: 'Could not create your order. Please try again.' }
    }
  }

  for (const programmeId of programmeIds) {
    const programme = programmeMap.get(programmeId)!
    const { error: itemError } = await adminClient.from('order_items').insert({
      order_id: orderId,
      student_id: null,
      manual_student_first_name: childFirstName,
      manual_student_last_name: childLastName,
      class_id: childClassId,
      student_name_snapshot: `${childFirstName} ${childLastName}`,
      class_name_snapshot: cls.name,
      teacher_name_snapshot: teacherName,
      activity_id: null,
      activity_name_snapshot: null,
      programme_id: programmeId,
      programme_name_snapshot: programme.name,
      unit_amount_cents: programme.price_cents,
      verification_status: 'manual_review' as const,
    })

    if (itemError) {
      logger.error('create_order_item_failed', { orderId, error: itemError.message })
      await adminClient.from('orders').delete().eq('id', orderId)
      return { error: 'Could not create your order. Please try again.' }
    }
  }

  await audit({
    schoolId: schoolId,
    actorEmail: payerEmail,
    action: 'order.created',
    resourceType: 'order',
    resourceId: orderId,
    metadata: {
      order_reference,
      source: 'guest_manual',
      activity_count: activityIds.length,
      programme_count: programmeIds.length,
      item_count: basket.length,
      total_cents: totalCents,
    },
    correlationId,
  })

  if (paymentLinkId) {
    await incrementPaymentLinkUseCount(adminClient, paymentLinkId)
  }

  return { orderId }
}

// ─── Shared: Validate programme is open for enrolment ─────────────────────────

type ProgrammeForOrder = Pick<
  ProgrammeRow,
  | 'id'
  | 'name'
  | 'price_cents'
  | 'currency'
  | 'school_id'
  | 'publication_status'
  | 'is_active'
  | 'max_enrolments'
>

function validateProgrammeOpen(programme: ProgrammeForOrder): string | null {
  if (programme.publication_status !== 'published' || !programme.is_active) {
    return 'This programme is not currently available for enrolment.'
  }
  return null
}

// ─── Create Registered Parent Order (multi-item basket) ───────────────────────
// basket is a JSON string of discriminated basket items:
//   { kind: 'activity'; studentId; activityId }
// | { kind: 'programme'; studentId; programmeId }
// Prices are read from DB — never trusted from the client.
// Returns { orderId } — client handles redirect and basket clearing.

export async function createParentOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await requireVerifiedAuth()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }

  const result = parentOrderSchema.safeParse({ basket: formData.get('basket') })
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return { fieldErrors: { basket: fe.basket?.[0] } }
  }

  const basketItems = result.data.basket
  const uniqueStudentIds = [...new Set(basketItems.map((i) => i.studentId))]

  const activityItems = basketItems.filter((i) => i.kind === 'activity')
  const programmeItems = basketItems.filter((i) => i.kind === 'programme')

  const uniqueActivityIds = [...new Set(activityItems.map((i) => i.activityId))]
  const uniqueProgrammeIds = [...new Set(programmeItems.map((i) => i.programmeId))]

  const supabase = await createSupabaseServerClient()

  // 1. Verify parent has an active link to every student in the basket
  const { data: linkData } = await supabase
    .from('parent_student_links')
    .select('student_id')
    .eq('parent_id', user.id)
    .in('student_id', uniqueStudentIds)
    .eq('is_active', true)

  const linkedIds = new Set(
    ((linkData as { student_id: string }[] | null) ?? []).map((l) => l.student_id),
  )
  if (!uniqueStudentIds.every((id) => linkedIds.has(id))) {
    return { error: 'You do not have an active link to one or more children in your basket.' }
  }

  const adminClient = createSupabaseAdminClient()

  // 2a. Batch-fetch and validate activities
  const activityMap = new Map<string, ActivityForOrder>()
  if (uniqueActivityIds.length > 0) {
    const { data: activitiesData } = await supabase
      .from('activities')
      .select(
        'id, name, amount_cents, currency, school_id, publication_status, is_active, opens_at, closes_at',
      )
      .in('id', uniqueActivityIds)

    for (const a of (activitiesData as ActivityForOrder[] | null) ?? []) {
      activityMap.set(a.id, a)
    }

    for (const activityId of uniqueActivityIds) {
      const activity = activityMap.get(activityId)
      if (!activity) return { error: 'This activity is not currently available for payment.' }
      const err = validateActivityOpen(activity)
      if (err) return { error: err }
    }
  }

  // 2b. Batch-fetch and validate programmes (admin client — school-scoped)
  const programmeMap = new Map<string, ProgrammeForOrder>()
  if (uniqueProgrammeIds.length > 0) {
    const { data: programmesData } = await adminClient
      .from('programmes')
      .select(
        'id, name, price_cents, currency, school_id, publication_status, is_active, max_enrolments',
      )
      .in('id', uniqueProgrammeIds)
      .eq('school_id', user.schoolId)

    for (const p of (programmesData as ProgrammeForOrder[] | null) ?? []) {
      programmeMap.set(p.id, p)
    }

    for (const programmeId of uniqueProgrammeIds) {
      const programme = programmeMap.get(programmeId)
      if (!programme) return { error: 'This programme is not currently available for enrolment.' }
      const err = validateProgrammeOpen(programme)
      if (err) return { error: err }
    }
  }

  // 3. Batch-fetch students.
  // auth.uid() is null in the Next.js server action context so RLS on students
  // returns 0 rows. Use the admin client and restrict to already-verified linkedIds.
  type StudentWithClass = {
    id: string
    first_name: string
    last_name: string
    class_id: string
    classes: {
      name: string
      teachers: { display_name: string | null; first_name: string; last_name: string } | null
    } | null
  }

  const { data: studentsData } = await adminClient
    .from('students')
    .select(
      'id, first_name, last_name, class_id, classes(name, teachers(display_name, first_name, last_name))',
    )
    .in('id', Array.from(linkedIds))

  const studentMap = new Map(
    ((studentsData as StudentWithClass[] | null) ?? []).map((s) => [s.id, s]),
  )

  // 4a. Check class AND pupil eligibility for activity items
  if (activityItems.length > 0) {
    const { data: classEligData } = await adminClient
      .from('activity_class_eligibility')
      .select('activity_id, class_id')
      .in('activity_id', uniqueActivityIds)

    const classEligibilitySet = new Set(
      ((classEligData as { activity_id: string; class_id: string }[] | null) ?? []).map(
        (e) => `${e.activity_id}:${e.class_id}`,
      ),
    )

    const { data: pupilEligData } = await adminClient
      .from('activity_pupil_eligibility')
      .select('activity_id, student_id')
      .in('activity_id', uniqueActivityIds)
      .in('student_id', uniqueStudentIds)

    const pupilEligibilitySet = new Set(
      ((pupilEligData as { activity_id: string; student_id: string }[] | null) ?? []).map(
        (e) => `${e.activity_id}:${e.student_id}`,
      ),
    )

    for (const item of activityItems) {
      const student = studentMap.get(item.studentId)
      if (!student) return { error: 'Student not found.' }
      const isClassEligible = classEligibilitySet.has(`${item.activityId}:${student.class_id}`)
      const isPupilEligible = pupilEligibilitySet.has(`${item.activityId}:${item.studentId}`)
      if (!isClassEligible && !isPupilEligible) {
        const activity = activityMap.get(item.activityId)
        return {
          error: `"${activity?.name ?? 'An activity'}" is not available for ${student.first_name}.`,
        }
      }
    }
  }

  // 4b. Check class eligibility for programme items
  if (programmeItems.length > 0) {
    const { data: progEligData } = await adminClient
      .from('programme_class_eligibility')
      .select('programme_id, class_id')
      .in('programme_id', uniqueProgrammeIds)

    const progEligibilitySet = new Set(
      ((progEligData as { programme_id: string; class_id: string }[] | null) ?? []).map(
        (e) => `${e.programme_id}:${e.class_id}`,
      ),
    )

    for (const item of programmeItems) {
      const student = studentMap.get(item.studentId)
      if (!student) return { error: 'Student not found.' }
      if (!progEligibilitySet.has(`${item.programmeId}:${student.class_id}`)) {
        const programme = programmeMap.get(item.programmeId)
        return {
          error: `"${programme?.name ?? 'A programme'}" is not available for ${student.first_name}'s class.`,
        }
      }
    }
  }

  // 5a. Duplicate detection for activity items (FR-ORD-007)
  if (activityItems.length > 0) {
    const { data: existingActivityItems } = await adminClient
      .from('order_items')
      .select('student_id, activity_id, order_id')
      .in('student_id', uniqueStudentIds)
      .in('activity_id', uniqueActivityIds)

    if (existingActivityItems && existingActivityItems.length > 0) {
      type ExistingItem = { student_id: string; activity_id: string; order_id: string }
      const basketPairs = new Set(activityItems.map((i) => `${i.studentId}:${i.activityId}`))
      const matching = (existingActivityItems as ExistingItem[]).filter(
        (ei) => ei.activity_id !== null && basketPairs.has(`${ei.student_id}:${ei.activity_id}`),
      )

      if (matching.length > 0) {
        const orderIds = [...new Set(matching.map((i) => i.order_id))]
        const { data: activeOrders } = await adminClient
          .from('orders')
          .select('id')
          .in('id', orderIds)
          .in('status', ['paid', 'pending_payment'])
          .limit(1)

        if (activeOrders && activeOrders.length > 0) {
          return {
            error: 'One or more activities in your basket already have an active or paid order.',
          }
        }
      }
    }
  }

  // 5b. Duplicate detection for programme items
  if (programmeItems.length > 0) {
    const { data: existingProgrammeItems } = await adminClient
      .from('order_items')
      .select('student_id, programme_id, order_id')
      .in('student_id', uniqueStudentIds)
      .in('programme_id', uniqueProgrammeIds)

    if (existingProgrammeItems && existingProgrammeItems.length > 0) {
      type ExistingProgItem = { student_id: string; programme_id: string | null; order_id: string }
      const basketPairs = new Set(programmeItems.map((i) => `${i.studentId}:${i.programmeId}`))
      const matching = (existingProgrammeItems as ExistingProgItem[]).filter(
        (ei) => ei.programme_id !== null && basketPairs.has(`${ei.student_id}:${ei.programme_id}`),
      )

      if (matching.length > 0) {
        const orderIds = [...new Set(matching.map((i) => i.order_id))]
        const { data: activeOrders } = await adminClient
          .from('orders')
          .select('id')
          .in('id', orderIds)
          .in('status', ['paid', 'pending_payment'])
          .limit(1)

        if (activeOrders && activeOrders.length > 0) {
          return {
            error:
              'One or more programmes in your basket already have an active or paid enrolment.',
          }
        }
      }
    }
  }

  // 5c. Enrolment cap check for programme items
  if (programmeItems.length > 0) {
    for (const programmeId of uniqueProgrammeIds) {
      const programme = programmeMap.get(programmeId)!
      if (programme.max_enrolments === null) continue

      const { count } = await adminClient
        .from('order_items')
        // Count via an inner join on the parent order rather than fetching every
        // paid/pending order id first: that read was unbounded (all schools) and
        // PostgREST caps returned rows, so past the cap the id list truncated and
        // the enrolment count silently under-reported — letting a programme
        // over-enrol past max_enrolments. programme_id is school-unique, so this
        // stays correctly scoped.
        .select('id, orders!inner(status)', { count: 'exact', head: true })
        .eq('programme_id', programmeId)
        .in('orders.status', ['paid', 'pending_payment'])

      const enrolled = count ?? 0
      const enrollingCount = programmeItems.filter((i) => i.programmeId === programmeId).length
      if (enrolled + enrollingCount > programme.max_enrolments) {
        return {
          error: `"${programme.name}" has reached its maximum enrolment of ${programme.max_enrolments}.`,
        }
      }
    }
  }

  // 6. Calculate total server-side — client basket amounts are display-only
  const activityTotal = activityItems.reduce(
    (sum, item) => sum + (activityMap.get(item.activityId)?.amount_cents ?? 0),
    0,
  )
  const programmeTotal = programmeItems.reduce(
    (sum, item) => sum + (programmeMap.get(item.programmeId)?.price_cents ?? 0),
    0,
  )
  const totalCents = activityTotal + programmeTotal

  // Derive school_id and currency from whichever item type is present
  const schoolId =
    (uniqueActivityIds.length > 0
      ? activityMap.get(uniqueActivityIds[0] as string)?.school_id
      : programmeMap.get(uniqueProgrammeIds[0] as string)?.school_id) ?? user.schoolId

  const currency =
    (uniqueActivityIds.length > 0
      ? activityMap.get(uniqueActivityIds[0] as string)?.currency
      : programmeMap.get(uniqueProgrammeIds[0] as string)?.currency) ?? 'EUR'

  const correlationId = createCorrelationId()

  // 7. Create the order
  const { data: orderData, error: orderError } = await adminClient
    .from('orders')
    .insert({
      school_id: schoolId,
      payer_profile_id: user.id,
      currency,
      subtotal_cents: totalCents,
      total_cents: totalCents,
      status: 'draft' as const,
      source: 'registered_parent' as const,
      correlation_id: correlationId,
    })
    .select('id, order_reference')
    .single()

  if (orderError || !orderData) {
    logger.error('create_order_failed', { error: orderError?.message })
    return { error: 'Could not create your order. Please try again.' }
  }

  const { id: orderId, order_reference } = orderData as { id: string; order_reference: string }

  // 8. Insert activity order items
  for (const item of activityItems) {
    const activity = activityMap.get(item.activityId)!
    const student = studentMap.get(item.studentId)!

    const { error: itemError } = await adminClient.from('order_items').insert({
      order_id: orderId,
      student_id: item.studentId,
      class_id: student.class_id,
      student_name_snapshot: `${student.first_name} ${student.last_name}`,
      class_name_snapshot: student.classes?.name ?? 'Unknown',
      teacher_name_snapshot: resolveTeacherDisplayName(student.classes?.teachers ?? null),
      activity_id: item.activityId,
      activity_name_snapshot: activity.name,
      programme_id: null,
      programme_name_snapshot: null,
      unit_amount_cents: activity.amount_cents,
      verification_status: 'verified_link' as const,
    })

    if (itemError) {
      logger.error('create_order_item_failed', { orderId, error: itemError.message })
      await adminClient.from('orders').delete().eq('id', orderId)
      return { error: 'Could not create your order. Please try again.' }
    }
  }

  // 9. Insert programme order items
  for (const item of programmeItems) {
    const programme = programmeMap.get(item.programmeId)!
    const student = studentMap.get(item.studentId)!

    const { error: itemError } = await adminClient.from('order_items').insert({
      order_id: orderId,
      student_id: item.studentId,
      class_id: student.class_id,
      student_name_snapshot: `${student.first_name} ${student.last_name}`,
      class_name_snapshot: student.classes?.name ?? 'Unknown',
      teacher_name_snapshot: resolveTeacherDisplayName(student.classes?.teachers ?? null),
      activity_id: null,
      activity_name_snapshot: null,
      programme_id: item.programmeId,
      programme_name_snapshot: programme.name,
      unit_amount_cents: programme.price_cents,
      verification_status: 'verified_link' as const,
    })

    if (itemError) {
      logger.error('create_order_item_failed', { orderId, error: itemError.message })
      await adminClient.from('orders').delete().eq('id', orderId)
      return { error: 'Could not create your order. Please try again.' }
    }
  }

  // 10. Audit
  await audit({
    schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'order.created',
    resourceType: 'order',
    resourceId: orderId,
    metadata: {
      order_reference,
      source: 'registered_parent',
      activity_count: activityItems.length,
      programme_count: programmeItems.length,
      item_count: basketItems.length,
      total_cents: totalCents,
    },
    correlationId,
  })

  return { orderId }
}
