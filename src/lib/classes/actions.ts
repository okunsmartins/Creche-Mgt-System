'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

interface RoomFields {
  name: string
  teacherId: string | null
  academicYear: string | null
  capacity: number | null
}

/** Validate the room form fields shared by create + update. */
function parseRoomFields(
  formData: FormData,
): { ok: true; fields: RoomFields } | { ok: false; error: string } {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  if (name === '') return { ok: false, error: 'A room name is required.' }
  if (name.length > 100) return { ok: false, error: 'Room name is too long (max 100 characters).' }
  const teacherId = (formData.get('teacherId') as string | null) || null
  const academicYear = (formData.get('academicYear') as string | null)?.trim() || null

  // Capacity: blank → null (no limit); otherwise a non-negative integer.
  const capacityRaw = (formData.get('capacity') as string | null)?.trim() ?? ''
  let capacity: number | null = null
  if (capacityRaw !== '') {
    const n = Number(capacityRaw)
    if (!Number.isInteger(n) || n < 0)
      return { ok: false, error: 'Capacity must be a whole number of 0 or more.' }
    capacity = n
  }
  return { ok: true, fields: { name, teacherId, academicYear, capacity } }
}

/** A staff member id is only accepted if it belongs to this crèche. */
async function teacherInSchool(teacherId: string | null, schoolId: string): Promise<boolean> {
  if (!teacherId) return true
  const { data } = await createSupabaseAdminClient()
    .from('teachers')
    .select('id')
    .eq('id', teacherId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return !!data
}

/** Create a new room for the admin's crèche, added at the end of the room order. */
export async function createClassAction(
  _prev: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }

  const parsed = parseRoomFields(formData)
  if (!parsed.ok) return { error: parsed.error }
  const { name, teacherId, academicYear, capacity } = parsed.fields
  if (!(await teacherInSchool(teacherId, user.schoolId)))
    return { error: 'That staff member was not found in your crèche.' }

  const adminClient = createSupabaseAdminClient()
  const { data: last } = await adminClient
    .from('classes')
    .select('display_order')
    .eq('school_id', user.schoolId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const displayOrder = ((last as { display_order: number } | null)?.display_order ?? 0) + 1

  const { data: created, error } = await adminClient
    .from('classes')
    .insert({
      school_id: user.schoolId,
      name,
      teacher_id: teacherId,
      academic_year: academicYear,
      capacity,
      display_order: displayOrder,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !created) {
    // 23505 = unique_violation on (school_id, name): another room already uses it.
    if ((error as { code?: string } | null)?.code === '23505')
      return { error: 'Another room already uses that name.' }
    logger.error('create_class_failed', { schoolId: user.schoolId, error: error?.message })
    return { error: 'Could not create the room. Please try again.' }
  }
  const classId = (created as { id: string }).id

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'class.created',
    resourceId: classId,
    metadata: { name, teacher_id: teacherId, academic_year: academicYear, capacity },
  })
  await onStaffOrRoomChanged(user.schoolId)

  revalidatePath('/admin/classes')
  revalidatePath('/admin/places')
  revalidatePath('/admin/dashboard')
  redirect('/admin/classes?created=1')
}

export async function updateClassAction(
  classId: string,
  _prev: ClassActionState,
  formData: FormData,
): Promise<ClassActionState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }

  const parsed = parseRoomFields(formData)
  if (!parsed.ok) return { error: parsed.error }
  const { name, teacherId, academicYear, capacity } = parsed.fields
  const isActive = formData.get('isActive') === 'true'
  if (!(await teacherInSchool(teacherId, user.schoolId)))
    return { error: 'That staff member was not found in your crèche.' }

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
      capacity,
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
  revalidatePath('/admin/places')
  revalidatePath('/admin/dashboard')

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'class.updated',
    resourceId: classId,
    metadata: {
      name,
      teacher_id: teacherId,
      academic_year: academicYear,
      is_active: isActive,
      capacity,
    },
  })

  await onStaffOrRoomChanged(user.schoolId)
  return { success: true }
}
