'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import {
  ASSIGNMENT_MAX_BYTES,
  acceptedAssignmentType,
  formatFileSize,
} from '@/lib/assignments/validate'
import { DOCUMENT_BUCKET, documentStoragePath, isDocumentCategory } from './validate'
import type { SessionUser } from '@/types'

export type DocumentActionState = { error?: string; success?: boolean }

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']

type StudentStaffRow = {
  school_id: string
  classes: {
    teacher_id: string | null
    teachers: { email: string | null; is_active: boolean } | null
  } | null
}

/**
 * Returns the student's school_id when the signed-in user is allowed to manage
 * that student's documents — a school admin of the student's school, or the
 * active teacher of the student's class — otherwise null.
 */
async function staffSchoolForStudent(
  user: SessionUser,
  adminClient: AdminClient,
  studentId: string,
): Promise<string | null> {
  const { data } = await adminClient
    .from('students')
    .select('school_id, classes(teacher_id, teachers(email, is_active))')
    .eq('id', studentId)
    .maybeSingle()
  const student = data as StudentStaffRow | null
  if (!student) return null

  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r))
  if (isAdmin && user.schoolId === student.school_id) return student.school_id

  const teacher = student.classes?.teachers
  if (
    user.roles.includes('teacher') &&
    teacher?.is_active &&
    teacher.email &&
    teacher.email.toLowerCase() === user.email.toLowerCase()
  ) {
    return student.school_id
  }
  return null
}

/**
 * Upload a document (test result / report card) for a student. Staff-only:
 * authorised as the student's class teacher or a school admin. School is derived
 * from that check, never from the client.
 */
export async function uploadStudentDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const user = await requireAuth()

  const studentId = (formData.get('studentId') as string | null)?.trim()
  if (!studentId) return { error: 'Missing student.' }
  const category = (formData.get('category') as string | null) ?? ''
  if (!isDocumentCategory(category)) return { error: 'Unknown document type.' }
  const title = ((formData.get('title') as string | null) ?? '').trim() || null
  const term = ((formData.get('term') as string | null) ?? '').trim() || null

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Please choose a file.' }
  const accepted = acceptedAssignmentType(file.type)
  if (!accepted) return { error: 'File must be an image (JPG/PNG) or a PDF.' }
  if (file.size > ASSIGNMENT_MAX_BYTES) {
    return { error: `File is too large (max ${formatFileSize(ASSIGNMENT_MAX_BYTES)}).` }
  }

  const adminClient = createSupabaseAdminClient()
  const schoolId = await staffSchoolForStudent(user, adminClient, studentId)
  if (!schoolId) return { error: 'You are not authorised to upload for this student.' }

  const path = documentStoragePath({
    schoolId,
    studentId,
    category,
    originalName: file.name,
    ext: accepted.ext,
  })

  const { error: uploadError } = await adminClient.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) {
    logger.error('document_upload_failed', { studentId, category, error: uploadError.message })
    return { error: 'Could not upload the file. Please try again.' }
  }

  const { error: insertError } = await adminClient.from('student_documents').insert({
    school_id: schoolId,
    student_id: studentId,
    uploaded_by: user.id,
    category,
    title,
    term,
    file_path: path,
    file_kind: accepted.kind,
    content_type: file.type,
    file_size_bytes: file.size,
    original_filename: file.name,
  })
  if (insertError) {
    logger.error('document_insert_failed', { studentId, category, error: insertError.message })
    await adminClient.storage.from(DOCUMENT_BUCKET).remove([path])
    return { error: 'Could not save the upload. Please try again.' }
  }

  logger.info('document_uploaded', { studentId, category, schoolId, by: user.id })
  revalidatePath(`/admin/students/${studentId}`)
  revalidatePath('/parent/reports')
  revalidatePath('/teacher/test-results')
  return { success: true }
}

/** Delete a staff-uploaded document (row + object). Same staff authorization. */
export async function deleteStudentDocumentAction(
  documentId: string,
): Promise<DocumentActionState> {
  const user = await requireAuth()
  const adminClient = createSupabaseAdminClient()

  const { data } = await adminClient
    .from('student_documents')
    .select('id, student_id, file_path')
    .eq('id', documentId)
    .maybeSingle()
  const row = data as { id: string; student_id: string; file_path: string } | null
  if (!row) return { error: 'Document not found.' }

  const schoolId = await staffSchoolForStudent(user, adminClient, row.student_id)
  if (!schoolId) return { error: 'You are not authorised to remove this document.' }

  const { error } = await adminClient.from('student_documents').delete().eq('id', documentId)
  if (error) {
    logger.error('document_delete_failed', { documentId, error: error.message })
    return { error: 'Could not remove the document. Please try again.' }
  }
  await adminClient.storage.from(DOCUMENT_BUCKET).remove([row.file_path])

  logger.info('document_deleted', { documentId, by: user.id })
  revalidatePath(`/admin/students/${row.student_id}`)
  revalidatePath('/parent/reports')
  revalidatePath('/teacher/test-results')
  return { success: true }
}
