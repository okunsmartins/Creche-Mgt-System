'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { resendSingleEmail } from './send'

export type ResendEmailState = { success?: boolean; error?: string } | null

const resendSchema = z.object({
  orderId: z.string().uuid(),
  type: z.enum(['payer_receipt', 'school_notification']),
})

export async function resendEmailAction(
  _prev: ResendEmailState,
  formData: FormData,
): Promise<ResendEmailState> {
  const admin = await requireAdmin()

  const result = resendSchema.safeParse({
    orderId: formData.get('orderId'),
    type: formData.get('type'),
  })
  if (!result.success) return { error: 'Invalid request.' }

  const { orderId, type } = result.data
  const adminClient = createSupabaseAdminClient()

  // Verify the order exists and belongs to this admin's school
  const { data: order } = await adminClient
    .from('orders')
    .select('id, status, school_id')
    .eq('id', orderId)
    .eq('school_id', admin.schoolId ?? '')
    .single()

  if (!order) return { error: 'Order not found.' }

  type OrderCheck = { status: string }
  if ((order as OrderCheck).status !== 'paid') {
    return { error: 'Emails can only be resent for paid orders.' }
  }

  const { error } = await resendSingleEmail(orderId, type, adminClient)
  if (error) return { error }

  await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId ?? null,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'email.resent',
    resource_type: 'order',
    resource_id: orderId,
    metadata: { type },
    correlation_id: null,
    ip_address: null,
  })

  logger.info('admin_email_resent', { orderId, type, adminId: admin.id })

  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true }
}
