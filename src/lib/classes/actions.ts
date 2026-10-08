'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { onStaffOrRoomChanged } from '@/lib/funding/events'
import type { AuditAction } from '@/types/database'

export type ClassActionState = {
  error?: string
  success?: boolean
}

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
    resource_type: 'class',
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('audit_log_failed', { action: params.action, error: error.message })
}

export async function updateClassAction(
  classId: string,
  _prev: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  if (name === '') return { error: 'A room name is required.' }
  if (name.length > 100) return { error: 'Room name is too long (max 100 characters).' }
  const teacherId = (formData.get('teacherId') as string | null) || null
  const academicYear = (formData.get('academicYear') as string | null)?.trim() || null
  const isActive = formData.get('isActive') === 'true'

  const adminClient = createSupabaseAdminClient()

  // `.select()` returns the updated rows so we can detect a 0-row no-op (e.g. the
  // class belongs to another school) instead of falsely reporting success.
  const { data: updated, error } = await adminClient
    .from('classes')
    .update({
      name,
      teacher_id: teacherId,
      academic_year: academicYear,
      is_active: isActive,
    })
    .eq('id', classId)
    .eq('school_id', user.schoolId)
    .select('id')

  if (error) {
    // 23505 = unique_violation on (school_id, name): another room already uses it.
    if ((error as { code?: string }).code === '23505')
      return { error: 'Another room already uses that name.' }
    logger.error('update_class_failed', { classId, error: error.message })
    return { error: 'Could not update class. Please try again.' }
  }

  if (!updated || updated.length === 0) {
    logger.warn('update_class_no_rows', { classId, schoolId: user.schoolId })
    return { error: 'Class not found, or it does not belong to your school.' }
  }

  // Purge the cached admin pages so the new teacher assignment shows immediately
  // when the admin navigates back to the list or re-opens this class. Without
  // this, the App Router serves the pre-save RSC and the change looks "lost".
  revalidatePath('/admin/classes')
  revalidatePath(`/admin/classes/${classId}`)

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'class.updated',
    resourceId: classId,
    metadata: { name, teacher_id: teacherId, academic_year: academicYear, is_active: isActive },
  })

  await onStaffOrRoomChanged(user.schoolId)
  return { success: true }
}
