'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import {
  createActivitySchema,
  updateActivitySchema,
  publishActivitySchema,
  archiveActivitySchema,
  closeActivitySchema,
  type ActivityActionState,
} from './schemas'
import type { ActivityRow, AuditAction } from '@/types/database'

// ─── Audit Helper ─────────────────────────────────────────────────────────────
// INSERT on audit_logs is REVOKED from authenticated/anon — must use admin client.

async function audit(params: {
  schoolId: string
  actorId: string
  actorEmail: string
  action: AuditAction
  resourceType: string
  resourceId?: string | undefined
  metadata?: Record<string, string | number | boolean | null> | undefined
}): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('audit_logs').insert({
    school_id: params.schoolId,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    correlation_id: null,
    ip_address: null,
  })
  if (error) {
    logger.error('audit_log_failed', { action: params.action, error: error.message })
  }
}

// ─── Create Activity ──────────────────────────────────────────────────────────

export async function createActivityAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const classIds = formData.getAll('classIds').filter((v): v is string => typeof v === 'string')
  const pupilIds = formData.getAll('pupilIds').filter((v): v is string => typeof v === 'string')

  const raw = {
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    amountEuros: formData.get('amountEuros'),
    accountingCode: formData.get('accountingCode') ?? undefined,
    opensAt: formData.get('opensAt') ?? undefined,
    closesAt: formData.get('closesAt') ?? undefined,
    classIds,
    pupilIds,
  }

  const result = createActivitySchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        name: fe.name?.[0],
        description: fe.description?.[0],
        amountEuros: fe.amountEuros?.[0],
        accountingCode: fe.accountingCode?.[0],
        opensAt: fe.opensAt?.[0],
        closesAt: fe.closesAt?.[0],
        classIds: fe.classIds?.[0],
        pupilIds: fe.pupilIds?.[0],
      },
    }
  }

  const {
    name,
    description,
    amountEuros: amountCents,
    accountingCode,
    opensAt,
    closesAt,
    classIds: validClassIds,
    pupilIds: validPupilIds,
  } = result.data

  const adminClient = createSupabaseAdminClient()

  const { data: activity, error: activityError } = await adminClient
    .from('activities')
    .insert({
      school_id: admin.schoolId,
      name,
      description: description ?? null,
      amount_cents: amountCents,
      currency: 'EUR',
      accounting_code: accountingCode ?? null,
      opens_at: opensAt ?? null,
      closes_at: closesAt ?? null,
      publication_status: 'draft',
      is_active: true,
      created_by: admin.id,
    })
    .select('id')
    .single()

  if (activityError || !activity) {
    logger.error('create_activity_failed', { error: activityError?.message })
    return { error: 'Failed to create activity. Please try again.' }
  }

  const activityId = (activity as Pick<ActivityRow, 'id'>).id

  if (validClassIds.length > 0) {
    const { error: eligibilityError } = await adminClient
      .from('activity_class_eligibility')
      .insert(validClassIds.map((classId) => ({ activity_id: activityId, class_id: classId })))

    if (eligibilityError) {
      logger.error('create_eligibility_failed', { activityId, error: eligibilityError.message })
      return {
        error:
          'Activity created but class eligibility could not be saved. Please edit the activity.',
      }
    }
  }

  if (validPupilIds.length > 0) {
    const { error: pupilEligibilityError } = await adminClient
      .from('activity_pupil_eligibility')
      .insert(
        validPupilIds.map((studentId) => ({ activity_id: activityId, student_id: studentId })),
      )

    if (pupilEligibilityError) {
      logger.error('create_pupil_eligibility_failed', {
        activityId,
        error: pupilEligibilityError.message,
      })
      return {
        error:
          'Activity created but pupil eligibility could not be saved. Please edit the activity.',
      }
    }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'activity.created',
    resourceType: 'activity',
    resourceId: activityId,
    metadata: { name, amount_cents: amountCents },
  })

  revalidatePath('/admin/activities')
  return { success: true, message: `"${name}" created as a draft.` }
}

// ─── Update Activity ──────────────────────────────────────────────────────────

export async function updateActivityAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const classIds = formData.getAll('classIds').filter((v): v is string => typeof v === 'string')
  const pupilIds = formData.getAll('pupilIds').filter((v): v is string => typeof v === 'string')

  const raw = {
    activityId: formData.get('activityId'),
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    amountEuros: formData.get('amountEuros'),
    accountingCode: formData.get('accountingCode') ?? undefined,
    opensAt: formData.get('opensAt') ?? undefined,
    closesAt: formData.get('closesAt') ?? undefined,
    classIds,
    pupilIds,
  }

  const result = updateActivitySchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        name: fe.name?.[0],
        description: fe.description?.[0],
        amountEuros: fe.amountEuros?.[0],
        accountingCode: fe.accountingCode?.[0],
        opensAt: fe.opensAt?.[0],
        closesAt: fe.closesAt?.[0],
        classIds: fe.classIds?.[0],
        pupilIds: fe.pupilIds?.[0],
      },
    }
  }

  const {
    activityId,
    name,
    description,
    amountEuros: amountCents,
    accountingCode,
    opensAt,
    closesAt,
    classIds: validClassIds,
    pupilIds: validPupilIds,
  } = result.data

  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('activities')
    .select('id, publication_status, amount_cents')
    .eq('id', activityId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Activity not found.' }

  const existingRow = existing as Pick<ActivityRow, 'id' | 'publication_status' | 'amount_cents'>
  if (existingRow.publication_status === 'archived') {
    return { error: 'Archived activities cannot be edited.' }
  }

  const { error: updateError } = await adminClient
    .from('activities')
    .update({
      name,
      description: description ?? null,
      amount_cents: amountCents,
      accounting_code: accountingCode ?? null,
      opens_at: opensAt ?? null,
      closes_at: closesAt ?? null,
    })
    .eq('id', activityId)

  if (updateError) {
    logger.error('update_activity_failed', { activityId, error: updateError.message })
    return { error: 'Failed to update activity. Please try again.' }
  }

  // Replace class eligibility: delete all then re-insert
  await adminClient.from('activity_class_eligibility').delete().eq('activity_id', activityId)

  if (validClassIds.length > 0) {
    const { error: eligibilityError } = await adminClient
      .from('activity_class_eligibility')
      .insert(validClassIds.map((classId) => ({ activity_id: activityId, class_id: classId })))

    if (eligibilityError) {
      logger.error('update_eligibility_failed', { activityId, error: eligibilityError.message })
      return { error: 'Activity updated but class eligibility could not be saved.' }
    }
  }

  // Replace pupil eligibility: delete all then re-insert
  await adminClient.from('activity_pupil_eligibility').delete().eq('activity_id', activityId)

  if (validPupilIds.length > 0) {
    const { error: pupilEligibilityError } = await adminClient
      .from('activity_pupil_eligibility')
      .insert(
        validPupilIds.map((studentId) => ({ activity_id: activityId, student_id: studentId })),
      )

    if (pupilEligibilityError) {
      logger.error('update_pupil_eligibility_failed', {
        activityId,
        error: pupilEligibilityError.message,
      })
      return { error: 'Activity updated but pupil eligibility could not be saved.' }
    }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'activity.updated',
    resourceType: 'activity',
    resourceId: activityId,
    metadata: { name, amount_cents: amountCents },
  })

  revalidatePath('/admin/activities')
  revalidatePath(`/admin/activities/${activityId}`)

  // FR-ACT-006: Warn if price changed and paid orders already exist for this activity.
  // Advisory only — the update has been saved. Existing order_items retain their
  // unit_amount_cents snapshots so no paid order amounts are changed.
  if (amountCents !== existingRow.amount_cents) {
    const { data: affectedItems } = await adminClient
      .from('order_items')
      .select('order_id')
      .eq('activity_id', activityId)

    if (affectedItems && affectedItems.length > 0) {
      type ItemRow = { order_id: string }
      const orderIds = (affectedItems as ItemRow[]).map((i) => i.order_id)
      const { count: paidCount } = await adminClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('id', orderIds)
        .in('status', ['paid', 'partially_refunded'])

      if (paidCount && paidCount > 0) {
        return {
          success: true,
          message: 'Activity updated.',
          warning: `The price was changed but ${paidCount} paid order${paidCount === 1 ? '' : 's'} for this activity will not be affected — those amounts are locked in.`,
        }
      }
    }
  }

  return { success: true, message: 'Activity updated.' }
}

// ─── Publish Activity ─────────────────────────────────────────────────────────
// Allows draft → published and closed → published (reopen).

export async function publishActivityAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const result = publishActivitySchema.safeParse({ activityId: formData.get('activityId') })
  if (!result.success) return { error: 'Invalid activity.' }

  const { activityId } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('activities')
    .select('id, name, publication_status')
    .eq('id', activityId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Activity not found.' }

  const existingRow = existing as Pick<ActivityRow, 'id' | 'name' | 'publication_status'>
  if (existingRow.publication_status !== 'draft' && existingRow.publication_status !== 'closed') {
    return { error: 'Only draft or closed activities can be published.' }
  }

  const { error } = await adminClient
    .from('activities')
    .update({ publication_status: 'published' })
    .eq('id', activityId)

  if (error) {
    logger.error('publish_activity_failed', { activityId, error: error.message })
    return { error: 'Failed to publish activity. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'activity.published',
    resourceType: 'activity',
    resourceId: activityId,
    metadata: { name: existingRow.name },
  })

  revalidatePath('/admin/activities')
  revalidatePath(`/admin/activities/${activityId}`)
  return { success: true, message: `"${existingRow.name}" is now published.` }
}

// ─── Close Activity ───────────────────────────────────────────────────────────
// Transitions published → closed. Closed activities are hidden from parents
// but can be re-published (unlike archived which is terminal).

export async function closeActivityAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const result = closeActivitySchema.safeParse({ activityId: formData.get('activityId') })
  if (!result.success) return { error: 'Invalid activity.' }

  const { activityId } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('activities')
    .select('id, name, publication_status')
    .eq('id', activityId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Activity not found.' }

  const existingRow = existing as Pick<ActivityRow, 'id' | 'name' | 'publication_status'>
  if (existingRow.publication_status !== 'published') {
    return { error: 'Only published activities can be closed.' }
  }

  const { error } = await adminClient
    .from('activities')
    .update({ publication_status: 'closed' })
    .eq('id', activityId)

  if (error) {
    logger.error('close_activity_failed', { activityId, error: error.message })
    return { error: 'Failed to close activity. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'activity.closed',
    resourceType: 'activity',
    resourceId: activityId,
    metadata: { name: existingRow.name },
  })

  revalidatePath('/admin/activities')
  revalidatePath(`/admin/activities/${activityId}`)
  return { success: true, message: `"${existingRow.name}" has been closed.` }
}

// ─── Archive Activity ─────────────────────────────────────────────────────────

export async function archiveActivityAction(
  _prev: ActivityActionState,
  formData: FormData,
): Promise<ActivityActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const result = archiveActivitySchema.safeParse({ activityId: formData.get('activityId') })
  if (!result.success) return { error: 'Invalid activity.' }

  const { activityId } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data: existing } = await adminClient
    .from('activities')
    .select('id, name, publication_status')
    .eq('id', activityId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!existing) return { error: 'Activity not found.' }

  const existingRow = existing as Pick<ActivityRow, 'id' | 'name' | 'publication_status'>
  if (existingRow.publication_status === 'archived') {
    return { error: 'Activity is already archived.' }
  }

  const { error } = await adminClient
    .from('activities')
    .update({ publication_status: 'archived' })
    .eq('id', activityId)

  if (error) {
    logger.error('archive_activity_failed', { activityId, error: error.message })
    return { error: 'Failed to archive activity. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'activity.archived',
    resourceType: 'activity',
    resourceId: activityId,
    metadata: { name: existingRow.name },
  })

  revalidatePath('/admin/activities')
  revalidatePath(`/admin/activities/${activityId}`)
  return { success: true, message: `"${existingRow.name}" has been archived.` }
}
