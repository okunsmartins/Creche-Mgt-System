'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createCorrelationId } from '@/lib/utils'

export type ReconciliationState = { success?: boolean; error?: string } | null

const matchPupilSchema = z.object({
  orderItemId: z.string().uuid('Invalid order item ID'),
  studentId: z.string().uuid('Invalid student ID'),
})

export async function matchPupilAction(
  _prev: ReconciliationState,
  formData: FormData,
): Promise<ReconciliationState> {
  const admin = await requireAdmin()

  const parsed = matchPupilSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { orderItemId, studentId } = parsed.data
  const adminClient = createSupabaseAdminClient()

  // Fetch item with its order's school to verify ownership
  const { data: itemRow } = await adminClient
    .from('order_items')
    .select(
      'id, verification_status, student_name_snapshot, class_name_snapshot, activity_name_snapshot, orders!inner(school_id)',
    )
    .eq('id', orderItemId)
    .single()

  if (!itemRow) return { error: 'Order item not found' }

  type ItemCheck = {
    id: string
    verification_status: string
    student_name_snapshot: string
    class_name_snapshot: string
    activity_name_snapshot: string
    orders: { school_id: string }
  }
  const item = itemRow as unknown as ItemCheck

  if (item.orders.school_id !== admin.schoolId) return { error: 'Order item not found' }
  if (item.verification_status !== 'manual_review') {
    return { error: 'Item is not in manual review status' }
  }

  // Verify student belongs to admin's school (FR-ADM-005: match without altering snapshot)
  const { data: studentRow } = await adminClient
    .from('students')
    .select('id, first_name, last_name, pupil_payment_code')
    .eq('id', studentId)
    .eq('school_id', admin.schoolId)
    .single()

  if (!studentRow) return { error: 'Student not found' }

  type StudentCheck = {
    id: string
    first_name: string
    last_name: string
    pupil_payment_code: string
  }
  const student = studentRow as StudentCheck

  // Update verification_status only — original snapshot columns are untouched
  const { error: updateError } = await adminClient
    .from('order_items')
    .update({ verification_status: 'manually_matched' as const })
    .eq('id', orderItemId)

  if (updateError) {
    return { error: 'Failed to update item status' }
  }

  // AT-017: reconciliation actions create audit entries
  await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'reconciliation.resolved',
    resource_type: 'order_item',
    resource_id: orderItemId,
    metadata: {
      matched_student_id: student.id,
      matched_student_name: `${student.first_name} ${student.last_name}`,
      matched_pupil_code: student.pupil_payment_code,
      snapshot_name: item.student_name_snapshot,
      snapshot_class: item.class_name_snapshot,
    },
    correlation_id: createCorrelationId(),
  })

  revalidatePath('/admin/reconciliation')
  return { success: true }
}
