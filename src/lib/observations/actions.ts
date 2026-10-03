'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses } from '@/lib/teachers/classes'
import { logger } from '@/lib/logging'
import type { SessionUser } from '@/types'
import {
  OBSERVATION_BUCKET,
  OBSERVATION_MAX_BYTES,
  acceptedImageExt,
  observationStoragePath,
  normaliseThemes,
  validateObservation,
} from './observations'

export type ObservationActionState = { error?: string; success?: boolean }

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

const ADMIN_ROLES = ['super_admin', 'school_admin', 'finance_admin']
const isAdminUser = (u: SessionUser) => u.roles.some((r) => ADMIN_ROLES.includes(r))

/**
 * Authorise a staff member to record/manage an observation for `studentId`, and
 * return that student's school_id (the tenant) — or null if they may not.
 *
 * - Admin: the student must belong to the admin's own school.
 * - Teacher: the student must be in one of the teacher's active classes.
 * This is the write gate for every observation action; the tenant is derived here,
 * never trusted from the client.
 */
async function staffStudentSchool(
  adminClient: AdminClient,
  user: SessionUser,
  studentId: string,
): Promise<string | null> {
  const { data } = await adminClient
    .from('students')
    .select('school_id, class_id')
    .eq('id', studentId)
    .maybeSingle()
  const student = data as { school_id: string; class_id: string | null } | null
  if (!student) return null

  if (isAdminUser(user)) {
    return student.school_id === user.schoolId ? student.school_id : null
  }
  if (user.roles.includes('teacher')) {
    const resolved = await resolveTeacherClasses(adminClient, user.email)
    const classIds = new Set((resolved?.classes ?? []).map((c) => c.id))
    if (student.class_id && classIds.has(student.class_id)) return student.school_id
  }
  return null
}

/**
 * Record a learning observation for a child. Staff-only (admin → any child in the
 * school; teacher → children in their classes). An optional photo goes to the
 * private `child-observations` bucket; the row stores its path. School is derived
 * from the verified authorisation, never from the client.
 */
export async function createObservationAction(
  _prev: ObservationActionState,
  formData: FormData,
): Promise<ObservationActionState> {
  const user = await requireVerifiedAuth()
  if (!isAdminUser(user) && !user.roles.includes('teacher')) {
    return { error: 'You do not have permission to record observations.' }
  }

  const studentId = (formData.get('studentId') as string | null)?.trim()
  if (!studentId) return { error: 'Please choose a child.' }

  const input = {
    title: ((formData.get('title') as string | null) ?? '').trim(),
    learningStory: ((formData.get('learningStory') as string | null) ?? '').trim(),
    observationDate: ((formData.get('observationDate') as string | null) ?? '').trim(),
    themes: formData.getAll('themes').map((t) => String(t)),
  }
  const valid = validateObservation(input)
  if (!valid.ok) return { error: valid.error }

  const nextSteps = ((formData.get('nextSteps') as string | null) ?? '').trim() || null
  const sharedWithParents = formData.get('sharedWithParents') !== null

  const adminClient = createSupabaseAdminClient()
  const schoolId = await staffStudentSchool(adminClient, user, studentId)
  if (!schoolId) return { error: 'You can only record observations for your own children.' }

  // Optional photo.
  let imagePath: string | null = null
  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    const ext = acceptedImageExt(file.type)
    if (!ext) return { error: 'The photo must be an image (JPG, PNG, WEBP or HEIC).' }
    if (file.size > OBSERVATION_MAX_BYTES) return { error: 'The photo is too large (max 10 MB).' }
    const path = observationStoragePath({ schoolId, studentId, originalName: file.name, ext })
    const { error: uploadError } = await adminClient.storage
      .from(OBSERVATION_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      logger.error('observation_upload_failed', { studentId, error: uploadError.message })
      return { error: 'Could not upload the photo. Please try again.' }
    }
    imagePath = path
  }

  const { error: insertError } = await adminClient.from('child_observations').insert({
    school_id: schoolId,
    student_id: studentId,
    author_profile_id: user.id,
    title: input.title,
    learning_story: input.learningStory,
    observation_date: input.observationDate,
    aistear_themes: normaliseThemes(input.themes),
    next_steps: nextSteps,
    image_path: imagePath,
    shared_with_parents: sharedWithParents,
  })
  if (insertError) {
    logger.error('observation_insert_failed', { studentId, error: insertError.message })
    if (imagePath) await adminClient.storage.from(OBSERVATION_BUCKET).remove([imagePath])
    return { error: 'Could not save the observation. Please try again.' }
  }

  logger.info('observation_created', { schoolId, studentId, by: user.id })
  revalidatePath('/admin/observations')
  revalidatePath('/teacher/observations')
  revalidatePath('/parent/learning-journal')
  return { success: true }
}

/**
 * Delete an observation (row + photo). Allowed for an admin of the owning school,
 * or the staff member who authored it. Verify-then-act: the row is loaded and
 * ownership checked before anything is removed.
 */
export async function deleteObservationAction(
  observationId: string,
): Promise<ObservationActionState> {
  const user = await requireVerifiedAuth()
  const adminClient = createSupabaseAdminClient()

  const { data } = await adminClient
    .from('child_observations')
    .select('id, school_id, author_profile_id, image_path')
    .eq('id', observationId)
    .maybeSingle()
  const row = data as {
    id: string
    school_id: string
    author_profile_id: string | null
    image_path: string | null
  } | null
  if (!row) return { error: 'Observation not found.' }

  const isOwningAdmin = isAdminUser(user) && row.school_id === user.schoolId
  const isAuthor = row.author_profile_id === user.id
  if (!isOwningAdmin && !isAuthor) {
    return { error: 'You can only delete your own observations.' }
  }

  const { error } = await adminClient
    .from('child_observations')
    .delete()
    .eq('id', observationId)
    .eq('school_id', row.school_id)
  if (error) {
    logger.error('observation_delete_failed', { observationId, error: error.message })
    return { error: 'Could not delete the observation. Please try again.' }
  }
  if (row.image_path) await adminClient.storage.from(OBSERVATION_BUCKET).remove([row.image_path])

  logger.info('observation_deleted', { observationId, by: user.id })
  revalidatePath('/admin/observations')
  revalidatePath('/teacher/observations')
  revalidatePath('/parent/learning-journal')
  return { success: true }
}
