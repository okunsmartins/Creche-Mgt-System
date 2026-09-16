'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { resolveTeacherContext } from '@/lib/messages/recipients'
import { sendPermissionSlipCreatedEmails } from './emails'
import { isSlipAudience, SLIP_TITLE_MAX, SLIP_DESC_MAX, SLIP_NOTE_MAX } from './validate'
import type { ParentMessageAudienceInput } from '@/lib/messages/schemas'

export type SlipActionState = { error?: string; success?: boolean }

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function classInSchool(
  adminClient: AdminClient,
  classId: string,
  schoolId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('school_id', schoolId)
    .maybeSingle()
  return !!data
}

/**
 * Create a permission slip. Admins may target any class or the whole school;
 * teachers may only target one of their own classes (never school-wide). School
 * is taken from the session, never the client.
 */
export async function createPermissionSlipAction(
  _prev: SlipActionState,
  formData: FormData,
): Promise<SlipActionState> {
  const user = await requireAuth()
  if (!user.schoolId) return { error: 'Your account is not linked to a school.' }
  const schoolId = user.schoolId

  const title = ((formData.get('title') as string | null) ?? '').trim()
  if (!title) return { error: 'Please enter a title.' }
  const description = ((formData.get('description') as string | null) ?? '').trim() || null
  const dueRaw = ((formData.get('dueDate') as string | null) ?? '').trim()
  const dueDate = DATE_RE.test(dueRaw) ? dueRaw : null
  const audienceType = (formData.get('audienceType') as string | null) ?? ''
  if (!isSlipAudience(audienceType)) return { error: 'Choose who this is for.' }
  const classId = ((formData.get('classId') as string | null) ?? '').trim() || null

  const adminClient = createSupabaseAdminClient()
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r))
  let createdByRole: 'admin' | 'teacher'

  if (isAdmin) {
    createdByRole = 'admin'
    if (audienceType === 'class') {
      if (!classId) return { error: 'Choose a class.' }
      if (!(await classInSchool(adminClient, classId, schoolId))) {
        return { error: 'That class was not found.' }
      }
    }
  } else if (user.roles.includes('teacher')) {
    createdByRole = 'teacher'
    if (audienceType === 'school') {
      return { error: 'Teachers can only create slips for their own class.' }
    }
    if (!classId) return { error: 'Choose a class.' }
    const ctx = await resolveTeacherContext(adminClient, schoolId, user.email)
    if (!ctx || !ctx.classIds.includes(classId)) {
      return { error: 'You can only create slips for your own class.' }
    }
  } else {
    return { error: 'You are not allowed to create permission slips.' }
  }

  const { error } = await adminClient.from('permission_slips').insert({
    school_id: schoolId,
    created_by: user.id,
    created_by_role: createdByRole,
    title: title.slice(0, SLIP_TITLE_MAX),
    description: description ? description.slice(0, SLIP_DESC_MAX) : null,
    due_date: dueDate,
    audience_type: audienceType,
    class_id: audienceType === 'class' ? classId : null,
    is_active: true,
  })
  if (error) {
    logger.error('permission_slip_create_failed', { schoolId, error: error.message })
    return { error: 'Could not create the permission slip. Please try again.' }
  }

  logger.info('permission_slip_created', { schoolId, audienceType, by: user.id })

  // Notify the audience's parents (best-effort; never fails slip creation).
  const audience: ParentMessageAudienceInput =
    audienceType === 'class' && classId ? { type: 'class', classId } : { type: 'school' }
  await sendPermissionSlipCreatedEmails(adminClient, schoolId, { title, dueDate, audience })

  revalidatePath('/admin/permission-slips')
  revalidatePath('/teacher/permission-slips')
  revalidatePath('/parent/permission-slips')
  return { success: true }
}

/**
 * Record a parent's consent (grant/decline) for one child on one slip. Verified
 * by the parent↔child link, and the slip must actually apply to that child.
 * One response per (slip, student) — upserted, so re-answering updates it.
 */
export async function respondToPermissionSlipAction(
  slipId: string,
  studentId: string,
  consent: boolean,
  note: string,
): Promise<SlipActionState> {
  const parent = await requireAuth()
  const adminClient = createSupabaseAdminClient()

  const { data: link } = await adminClient
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle()
  if (!link) return { error: 'You can only respond for your own child.' }

  const { data: studentRow } = await adminClient
    .from('students')
    .select('school_id, class_id')
    .eq('id', studentId)
    .maybeSingle()
  const student = studentRow as { school_id: string; class_id: string } | null
  if (!student) return { error: 'Student not found.' }

  const { data: slipRow } = await adminClient
    .from('permission_slips')
    .select('id, school_id, audience_type, class_id, is_active')
    .eq('id', slipId)
    .maybeSingle()
  const slip = slipRow as {
    id: string
    school_id: string
    audience_type: 'class' | 'school'
    class_id: string | null
    is_active: boolean
  } | null
  if (!slip || !slip.is_active) return { error: 'This permission slip is no longer available.' }

  const applies =
    slip.school_id === student.school_id &&
    (slip.audience_type === 'school' ||
      (slip.audience_type === 'class' && slip.class_id === student.class_id))
  if (!applies) return { error: 'This permission slip does not apply to your child.' }

  const trimmedNote = note.trim().slice(0, SLIP_NOTE_MAX) || null
  const { error } = await adminClient.from('permission_slip_responses').upsert(
    {
      slip_id: slipId,
      student_id: studentId,
      school_id: student.school_id,
      parent_id: parent.id,
      consent,
      note: trimmedNote,
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'slip_id,student_id' },
  )
  if (error) {
    logger.error('permission_slip_respond_failed', { slipId, studentId, error: error.message })
    return { error: 'Could not save your response. Please try again.' }
  }

  logger.info('permission_slip_responded', { slipId, studentId, consent, by: parent.id })
  revalidatePath('/parent/permission-slips')
  revalidatePath('/admin/permission-slips')
  return { success: true }
}

/** Remove a slip (cascade its responses). Admin, or the teacher of its class. */
export async function deletePermissionSlipAction(slipId: string): Promise<SlipActionState> {
  const user = await requireAuth()
  if (!user.schoolId) return { error: 'Your account is not linked to a school.' }
  const adminClient = createSupabaseAdminClient()

  const { data: slipRow } = await adminClient
    .from('permission_slips')
    .select('id, school_id, audience_type, class_id')
    .eq('id', slipId)
    .maybeSingle()
  const slip = slipRow as {
    id: string
    school_id: string
    audience_type: 'class' | 'school'
    class_id: string | null
  } | null
  if (!slip || slip.school_id !== user.schoolId) return { error: 'Permission slip not found.' }

  let allowed = user.roles.some((r) => ADMIN_ROLES.includes(r))
  if (
    !allowed &&
    user.roles.includes('teacher') &&
    slip.audience_type === 'class' &&
    slip.class_id
  ) {
    const ctx = await resolveTeacherContext(adminClient, user.schoolId, user.email)
    allowed = !!ctx && ctx.classIds.includes(slip.class_id)
  }
  if (!allowed) return { error: 'You are not allowed to remove this permission slip.' }

  const { error } = await adminClient.from('permission_slips').delete().eq('id', slipId)
  if (error) {
    logger.error('permission_slip_delete_failed', { slipId, error: error.message })
    return { error: 'Could not remove the permission slip. Please try again.' }
  }

  logger.info('permission_slip_deleted', { slipId, by: user.id })
  revalidatePath('/admin/permission-slips')
  revalidatePath('/teacher/permission-slips')
  revalidatePath('/parent/permission-slips')
  return { success: true }
}
