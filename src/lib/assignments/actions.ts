'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import {
  ASSIGNMENT_BUCKET,
  ASSIGNMENT_MAX_BYTES,
  acceptedAssignmentType,
  assignmentStoragePath,
  formatFileSize,
} from './validate'
import { sendAssignmentUploadedEmail } from './emails'

export type AssignmentActionState = { error?: string; success?: boolean }

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

/**
 * Verify the signed-in parent is actively linked to `studentId`, returning that
 * student's school_id (the tenant) or null when there is no active link. This is
 * the authorisation gate for every assignment action — a parent may only touch
 * their own linked child's uploads.
 */
async function linkedStudentSchoolId(
  adminClient: AdminClient,
  parentId: string,
  studentId: string,
): Promise<string | null> {
  const { data: link } = await adminClient
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle()
  if (!link) return null

  const { data: student } = await adminClient
    .from('students')
    .select('school_id')
    .eq('id', studentId)
    .maybeSingle()
  return (student as { school_id: string } | null)?.school_id ?? null
}

/**
 * Upload one assignment file (a camera photo or a PDF) for a linked child. The
 * file goes to the private `student-assignments` bucket via the service-role
 * client; a row records it. School is derived from the verified link, never from
 * the client.
 */
export async function uploadAssignmentAction(
  _prev: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const parent = await requireVerifiedAuth()

  const studentId = (formData.get('studentId') as string | null)?.trim()
  if (!studentId) return { error: 'Please choose a child.' }
  const title = ((formData.get('title') as string | null) ?? '').trim() || null

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Please choose a photo or PDF to upload.' }
  }
  const accepted = acceptedAssignmentType(file.type)
  if (!accepted) return { error: 'File must be a photo (JPG/PNG) or a PDF.' }
  if (file.size > ASSIGNMENT_MAX_BYTES) {
    return { error: `File is too large (max ${formatFileSize(ASSIGNMENT_MAX_BYTES)}).` }
  }

  const adminClient = createSupabaseAdminClient()
  const schoolId = await linkedStudentSchoolId(adminClient, parent.id, studentId)
  if (!schoolId) return { error: 'That child is not linked to your account.' }

  const path = assignmentStoragePath({
    schoolId,
    studentId,
    originalName: file.name,
    ext: accepted.ext,
  })

  const { error: uploadError } = await adminClient.storage
    .from(ASSIGNMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) {
    logger.error('assignment_upload_failed', { studentId, error: uploadError.message })
    return { error: 'Could not upload the file. Please try again.' }
  }

  const { error: insertError } = await adminClient.from('student_assignments').insert({
    school_id: schoolId,
    student_id: studentId,
    uploaded_by: parent.id,
    title,
    file_path: path,
    file_kind: accepted.kind,
    content_type: file.type,
    file_size_bytes: file.size,
    original_filename: file.name,
  })
  if (insertError) {
    logger.error('assignment_insert_failed', { studentId, error: insertError.message })
    // Don't orphan the just-uploaded object.
    await adminClient.storage.from(ASSIGNMENT_BUCKET).remove([path])
    return { error: 'Could not save the upload. Please try again.' }
  }

  logger.info('assignment_uploaded', { studentId, schoolId, kind: accepted.kind })

  // Notify the pupil's class teacher (best-effort; never fails the upload).
  const uploaderName =
    [parent.profile?.firstName, parent.profile?.lastName].filter(Boolean).join(' ') || null
  await sendAssignmentUploadedEmail(schoolId, studentId, adminClient, {
    title,
    uploaderName,
    fileKind: accepted.kind,
  })

  revalidatePath('/parent/assignments')
  return { success: true }
}

/** Remove one of the parent's linked child's uploads (row + storage object). */
export async function deleteAssignmentAction(assignmentId: string): Promise<AssignmentActionState> {
  const parent = await requireVerifiedAuth()
  const adminClient = createSupabaseAdminClient()

  const { data } = await adminClient
    .from('student_assignments')
    .select('id, student_id, file_path')
    .eq('id', assignmentId)
    .maybeSingle()
  const row = data as { id: string; student_id: string; file_path: string } | null
  if (!row) return { error: 'Upload not found.' }

  const schoolId = await linkedStudentSchoolId(adminClient, parent.id, row.student_id)
  if (!schoolId) return { error: 'You can only remove your own child’s uploads.' }

  const { error } = await adminClient.from('student_assignments').delete().eq('id', assignmentId)
  if (error) {
    logger.error('assignment_delete_failed', { assignmentId, error: error.message })
    return { error: 'Could not remove the upload. Please try again.' }
  }
  // Best-effort object cleanup; the row is already gone.
  await adminClient.storage.from(ASSIGNMENT_BUCKET).remove([row.file_path])

  logger.info('assignment_deleted', { assignmentId, by: parent.id })
  revalidatePath('/parent/assignments')
  return { success: true }
}
