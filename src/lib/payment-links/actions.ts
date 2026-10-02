'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { requireFeature } from '@/lib/subscriptions/access'
import { paymentLinkSchema, type PaymentLinkActionState } from './schemas'
import type { AuditAction } from '@/types/database'

async function audit(params: {
  schoolId: string
  actorId: string
  actorEmail: string
  action: AuditAction
  resourceId?: string
  metadata?: Record<string, string | number | boolean | null>
}): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient.from('audit_logs').insert({
    school_id: params.schoolId,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    resource_type: 'payment_link',
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('audit_log_failed', { action: params.action, error: error.message })
}

export async function createPaymentLinkAction(
  _prev: PaymentLinkActionState,
  formData: FormData,
): Promise<PaymentLinkActionState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }
  // Pro-gated: redirect to /pricing if this school can't use payment links.
  await requireFeature('payment_links', user.schoolId)

  const result = paymentLinkSchema.safeParse({
    activityId: formData.get('activityId'),
    label: formData.get('label'),
    expiresAt: formData.get('expiresAt') ?? '',
    maxUses: formData.get('maxUses') ?? '',
    isActive: formData.get('isActive') ?? 'true',
  })

  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      error: 'Please fix the errors below.',
      fieldErrors: {
        activityId: fe.activityId?.[0],
        label: fe.label?.[0],
        expiresAt: fe.expiresAt?.[0],
        maxUses: fe.maxUses?.[0],
      },
    }
  }

  const { activityId, label, expiresAt, maxUses, isActive } = result.data
  const adminClient = createSupabaseAdminClient()

  // Verify the activity belongs to this school and is not archived
  const { data: activityData } = await adminClient
    .from('activities')
    .select('id, name, is_active')
    .eq('id', activityId)
    .eq('school_id', user.schoolId)
    .single()

  if (!activityData || !(activityData as { is_active: boolean }).is_active) {
    return { error: 'Activity not found or inactive.' }
  }

  const { data, error } = await adminClient
    .from('payment_links')
    .insert({
      school_id: user.schoolId,
      activity_id: activityId,
      created_by: user.id,
      label,
      expires_at: expiresAt ?? null,
      max_uses: maxUses ?? null,
      is_active: isActive,
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error('create_payment_link_failed', { error: error?.message })
    return { error: 'Could not create payment link. Please try again.' }
  }

  const linkId = (data as { id: string }).id

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'payment_link.created',
    resourceId: linkId,
    metadata: { label, activity_id: activityId },
  })

  revalidatePath('/admin/payment-links')
  return { success: true, linkId }
}

export async function updatePaymentLinkAction(
  linkId: string,
  _prev: PaymentLinkActionState,
  formData: FormData,
): Promise<PaymentLinkActionState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }

  const isActive = formData.get('isActive') !== 'false'
  const label = (formData.get('label') as string | null)?.trim() ?? ''

  if (!label) return { error: 'Label is required.' }

  const adminClient = createSupabaseAdminClient()

  const { error } = await adminClient
    .from('payment_links')
    .update({ label, is_active: isActive })
    .eq('id', linkId)
    .eq('school_id', user.schoolId)

  if (error) {
    logger.error('update_payment_link_failed', { linkId, error: error.message })
    return { error: 'Could not update payment link. Please try again.' }
  }

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: isActive ? 'payment_link.updated' : 'payment_link.deactivated',
    resourceId: linkId,
    metadata: { label, is_active: isActive },
  })

  revalidatePath('/admin/payment-links')
  revalidatePath(`/admin/payment-links/${linkId}`)
  return { success: true, linkId }
}

/**
 * Increment visit_count for a payment link. Scoped by school_id so a caller can
 * only ever bump the counter of a link in the tenant it already resolved (the
 * public pay page knows the link's school_id). Read-modify-write; never throws.
 */
export async function incrementPaymentLinkVisitCount(
  linkId: string,
  schoolId: string,
): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('payment_links')
    .select('visit_count')
    .eq('id', linkId)
    .eq('school_id', schoolId)
    .single()
  if (!data) {
    logger.warn('increment_visit_count_link_not_found', { linkId })
    return
  }
  const { error } = await adminClient
    .from('payment_links')
    .update({ visit_count: (data as { visit_count: number }).visit_count + 1 })
    .eq('id', linkId)
    .eq('school_id', schoolId)
  if (error) logger.error('increment_visit_count_failed', { linkId, error: error.message })
}

export async function incrementPaymentLinkCompletedOrderCount(linkId: string): Promise<void> {
  const adminClient = createSupabaseAdminClient()
  const { data } = await adminClient
    .from('payment_links')
    .select('completed_order_count')
    .eq('id', linkId)
    .single()
  if (!data) {
    logger.warn('increment_completed_order_count_link_not_found', { linkId })
    return
  }
  const { error } = await adminClient
    .from('payment_links')
    .update({
      completed_order_count: (data as { completed_order_count: number }).completed_order_count + 1,
    })
    .eq('id', linkId)
  if (error)
    logger.error('increment_completed_order_count_failed', { linkId, error: error.message })
}
