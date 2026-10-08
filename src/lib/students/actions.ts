'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireAdmin, requireVerifiedAuth } from '@/lib/auth/guards'
import { requireFeature } from '@/lib/subscriptions/access'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { serverEnv } from '@/lib/env'
import { checkRateLimit } from '@/lib/rateLimit'
import { schoolCodePrefix } from '@/lib/utils'
import { parseStudentCsv } from './csv'
import {
  createStudentSchema,
  updateStudentSchema,
  parseStudentCareFields,
  linkRequestSchema,
  rejectLinkRequestSchema,
  approveLinkRequestSchema,
  adminLinkParentSchema,
  childSearchSchema,
  type StudentActionState,
  type ChildSearchState,
  type ChildSearchResult,
} from './schemas'
import type {
  StudentRow,
  ParentStudentLinkRow,
  ParentLinkRequestRow,
  ProfileRow,
  AuditAction,
} from '@/types/database'

// ─── School Resolution Helper ─────────────────────────────────────────────────
// For the single-school POC: if a parent's profile has no school_id yet
// (self-registered parents are not assigned a school at sign-up), look up the
// only school in the DB and auto-assign it to the parent's profile.

async function resolveSchoolId(
  parentId: string,
  currentSchoolId: string | null,
): Promise<string | null> {
  if (currentSchoolId) return currentSchoolId
  // Auto-assignment is only safe when exactly one school exists (single-school POC).
  // In production / multi-tenant deployments the school must be set explicitly.
  if (serverEnv.appEnv !== 'poc') {
    logger.warn('resolve_school_id_skipped_non_poc', { parentId })
    return null
  }
  const adminClient = createSupabaseAdminClient()
  // Fetch exactly two rows: if more than one exists this is not a single-school environment.
  const { data: schools } = await adminClient.from('schools').select('id').limit(2)
  if (!schools || schools.length !== 1) {
    logger.warn('resolve_school_id_ambiguous', { parentId, count: schools?.length ?? 0 })
    return null
  }
  const school = schools[0] as { id: string }
  const { error: assignError } = await adminClient
    .from('profiles')
    .update({ school_id: school.id })
    .eq('id', parentId)
  if (assignError) {
    logger.warn('resolve_school_id_assign_failed', {
      parentId,
      schoolId: school.id,
      error: assignError.message,
    })
  }
  return school.id
}

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

// ─── Create Student ───────────────────────────────────────────────────────────

export async function createStudentAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const raw = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    classId: formData.get('classId'),
    parentFirstName: formData.get('parentFirstName'),
    parentLastName: formData.get('parentLastName'),
    parentEmail: formData.get('parentEmail'),
  }

  const result = createStudentSchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        firstName: fe.firstName?.[0],
        lastName: fe.lastName?.[0],
        classId: fe.classId?.[0],
        parentFirstName: fe.parentFirstName?.[0],
        parentLastName: fe.parentLastName?.[0],
        parentEmail: fe.parentEmail?.[0],
      },
    }
  }

  const {
    firstName,
    lastName,
    classId,
    parentFirstName,
    parentLastName,
    parentEmail,
    parentMobile,
  } = result.data
  const adminClient = createSupabaseAdminClient()

  // Generate a unique pupil payment code via the DB function, prefixed with
  // this school's own code so pupils don't carry another tenant's prefix.
  const codeResult = await adminClient.rpc('generate_pupil_code', {
    p_prefix: schoolCodePrefix(admin.schoolName ?? ''),
  })
  const pupilCode = codeResult.data as string | null
  if (!pupilCode) {
    logger.error('generate_pupil_code_failed', {
      error: (codeResult.error as { message?: string } | null)?.message,
    })
    return { error: 'Failed to generate pupil code. Please try again.' }
  }

  const insertResult = await adminClient
    .from('students')
    .insert({
      school_id: admin.schoolId,
      first_name: firstName,
      last_name: lastName,
      class_id: classId,
      pupil_payment_code: pupilCode,
      parent_mobile: parentMobile?.trim() || null,
      is_active: true,
    })
    .select('id')
    .single()

  const inserted = insertResult.data as Pick<StudentRow, 'id'> | null

  if (insertResult.error || !inserted) {
    const msg = (insertResult.error as { message?: string } | null)?.message ?? ''
    logger.error('create_student_failed', { error: msg })
    return { error: 'Failed to create student. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'student.created',
    resourceType: 'student',
    resourceId: inserted.id,
    metadata: {
      first_name: firstName,
      last_name: lastName,
      class_id: classId,
      pupil_payment_code: pupilCode,
    },
  })

  // ── Parent account + link ────────────────────────────────────────────────────
  // Check if a profile already exists for this email address (any school).
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, school_id')
    .eq('email', parentEmail)
    .maybeSingle()

  type ProfileIdSchool = Pick<ProfileRow, 'id' | 'school_id'>
  let parentId: string

  const parentAlreadyRegistered = Boolean(existingProfile)

  if (existingProfile) {
    parentId = (existingProfile as ProfileIdSchool).id
    // Assign school if missing (self-registered parents may not have one yet)
    if (!(existingProfile as ProfileIdSchool).school_id) {
      await adminClient.from('profiles').update({ school_id: admin.schoolId }).eq('id', parentId)
    }
  } else {
    // Create a Supabase Auth user for the parent. They use "Forgot password" on
    // the login page to set their password and access the portal.
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: parentEmail,
      email_confirm: true,
      user_metadata: { first_name: parentFirstName, last_name: parentLastName },
    })

    if (authError || !authData?.user) {
      logger.error('create_parent_auth_failed', {
        error: (authError as { message?: string } | null)?.message ?? 'unknown',
      })
      revalidatePath('/admin/students')
      return {
        success: true,
        message: `Student created with code ${pupilCode}. Warning: could not create parent account for ${parentEmail} — link them manually from the student detail page.`,
      }
    }

    parentId = authData.user.id

    // Upsert profile: trigger may have fired but won't have school_id or correct names.
    await adminClient.from('profiles').upsert(
      {
        id: parentId,
        email: parentEmail,
        first_name: parentFirstName,
        last_name: parentLastName,
        school_id: admin.schoolId,
        email_verified: true,
        is_active: true,
      },
      { onConflict: 'id' },
    )
  }

  // Create the parent–student link (admin-initiated — no approval required).
  const { error: linkError } = await adminClient.from('parent_student_links').insert({
    parent_id: parentId,
    student_id: inserted.id,
    school_id: admin.schoolId,
    linked_by: admin.id,
    is_active: true,
  })

  const pgCode = (linkError as { code?: string } | null)?.code

  if (linkError && pgCode !== '23505') {
    logger.error('create_student_link_failed', {
      error: (linkError as { message?: string }).message,
      studentId: inserted.id,
    })
    revalidatePath('/admin/students')
    return {
      success: true,
      message: `Student created with code ${pupilCode}. Warning: could not link parent — link them from the student detail page.`,
    }
  }

  if (!linkError) {
    await audit({
      schoolId: admin.schoolId,
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'parent_student.linked',
      resourceType: 'parent_student_link',
      resourceId: inserted.id,
      metadata: { parent_email: parentEmail, student_id: inserted.id },
    })
  }

  revalidatePath('/admin/students')
  revalidatePath('/parent/children')

  const parentMsg = parentAlreadyRegistered
    ? `Linked to existing parent account (${parentEmail}).`
    : `A parent account has been created for ${parentEmail}. They can access the portal after setting a password via "Forgot password" on the login page.`

  return { success: true, message: `Student created with code ${pupilCode}. ${parentMsg}` }
}

// ─── Update Student ───────────────────────────────────────────────────────────

export async function updateStudentAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const raw = {
    studentId: formData.get('studentId'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    classId: formData.get('classId'),
  }

  const result = updateStudentSchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      fieldErrors: {
        firstName: fe.firstName?.[0],
        lastName: fe.lastName?.[0],
        classId: fe.classId?.[0],
      },
    }
  }

  const { studentId, firstName, lastName, classId } = result.data
  // Care record (emergency contact, allergies, dietary, medical, medication, session).
  // Values may be sensitive (health) — saved here, never logged or put in audit metadata.
  const care = parseStudentCareFields(formData)

  // Expected leaving date: blank → null; otherwise must be a valid YYYY-MM-DD date.
  const leavingRaw = (formData.get('leavingDate') as string | null)?.trim() ?? ''
  let leavingDate: string | null = null
  if (leavingRaw !== '') {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(leavingRaw) ||
      Number.isNaN(Date.parse(`${leavingRaw}T00:00:00Z`))
    )
      return { error: 'Leaving date must be a valid date.' }
    leavingDate = leavingRaw
  }

  const adminClient = createSupabaseAdminClient()

  const { error } = await adminClient
    .from('students')
    .update({
      first_name: firstName,
      last_name: lastName,
      class_id: classId,
      leaving_date: leavingDate,
      parent_mobile: care.parentMobile,
      emergency_contact_name: care.emergencyContactName,
      emergency_contact_phone: care.emergencyContactPhone,
      emergency_contact_relationship: care.emergencyContactRelationship,
      allergies: care.allergies,
      dietary_needs: care.dietaryNeeds,
      medical_conditions: care.medicalConditions,
      medication_consent: care.medicationConsent,
      medication_notes: care.medicationNotes,
      session: care.session,
    })
    .eq('id', studentId)
    .eq('school_id', admin.schoolId)

  if (error) {
    logger.error('update_student_failed', {
      error: (error as { message?: string }).message,
      studentId,
    })
    return { error: 'Failed to update student. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'student.updated',
    resourceType: 'student',
    resourceId: studentId,
    metadata: { first_name: firstName, last_name: lastName, class_id: classId },
  })

  revalidatePath('/admin/students')
  revalidatePath(`/admin/students/${studentId}`)
  return { success: true, message: 'Student updated.' }
}

// ─── Toggle Student Active / Deactivate ──────────────────────────────────────

export async function toggleStudentActiveAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const studentId = (formData.get('studentId') as string | null)?.trim()
  const activate = formData.get('activate') === 'true'

  if (!studentId) return { error: 'Missing student ID.' }

  const adminClient = createSupabaseAdminClient()
  const { error } = await adminClient
    .from('students')
    .update({ is_active: activate })
    .eq('id', studentId)
    .eq('school_id', admin.schoolId)

  if (error) {
    logger.error('toggle_student_active_failed', {
      error: (error as { message?: string }).message,
      studentId,
    })
    return { error: `Failed to ${activate ? 'reactivate' : 'deactivate'} student.` }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: activate ? 'student.updated' : 'student.deactivated',
    resourceType: 'student',
    resourceId: studentId,
    metadata: { is_active: activate },
  })

  revalidatePath('/admin/students')
  revalidatePath(`/admin/students/${studentId}`)
  return { success: true, message: `Student ${activate ? 'reactivated' : 'deactivated'}.` }
}

// ─── Regenerate Pupil Code ────────────────────────────────────────────────────

export async function regeneratePupilCodeAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const studentId = (formData.get('studentId') as string | null)?.trim()
  if (!studentId) return { error: 'Missing student ID.' }

  const adminClient = createSupabaseAdminClient()

  const codeResult = await adminClient.rpc('generate_pupil_code', {
    p_prefix: schoolCodePrefix(admin.schoolName ?? ''),
  })
  const newCode = codeResult.data as string | null
  if (!newCode) {
    logger.error('generate_pupil_code_failed', {
      error: (codeResult.error as { message?: string } | null)?.message,
    })
    return { error: 'Failed to generate new code. Please try again.' }
  }

  const { error } = await adminClient
    .from('students')
    .update({ pupil_payment_code: newCode })
    .eq('id', studentId)
    .eq('school_id', admin.schoolId)

  if (error) {
    logger.error('regenerate_pupil_code_failed', {
      error: (error as { message?: string }).message,
      studentId,
    })
    return { error: 'Failed to update pupil code. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'student.pupil_code_regenerated',
    resourceType: 'student',
    resourceId: studentId,
  })

  revalidatePath('/admin/students')
  revalidatePath(`/admin/students/${studentId}`)
  return { success: true, message: `Pupil code updated to ${newCode}.` }
}

// ─── Submit Link Request (parent) ────────────────────────────────────────────

export async function submitLinkRequestAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parent = await requireVerifiedAuth()
  const schoolId = await resolveSchoolId(parent.id, parent.schoolId)
  if (!schoolId) return { error: 'No school found. Please contact the school office.' }

  const raw = { pupilCode: formData.get('pupilCode') }
  const result = linkRequestSchema.safeParse(raw)
  if (!result.success) {
    return { fieldErrors: { pupilCode: result.error.flatten().fieldErrors.pupilCode?.[0] } }
  }

  const supabase = await createSupabaseServerClient()
  const adminClient = createSupabaseAdminClient()

  // Look up the student by pupil code within the school.
  // Use a generic "not found" message to prevent pupil enumeration.
  const studentResult = await supabase
    .from('students')
    .select('id, is_active')
    .eq('pupil_payment_code', result.data.pupilCode)
    .eq('school_id', schoolId)
    .maybeSingle()

  const student = studentResult.data as Pick<StudentRow, 'id' | 'is_active'> | null

  if (!student || !student.is_active) {
    return {
      error: "This pupil code was not found. Please check the code on your child's payment letter.",
    }
  }

  // Check for an existing active link
  const existingLinkResult = await supabase
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', student.id)
    .eq('is_active', true)
    .maybeSingle()

  const existingLink = existingLinkResult.data as Pick<ParentStudentLinkRow, 'id'> | null
  if (existingLink) {
    return { error: 'You are already linked to a child with this pupil code.' }
  }

  // Check for an existing pending request
  const existingRequestResult = await supabase
    .from('parent_link_requests')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', student.id)
    .eq('status', 'pending')
    .maybeSingle()

  const existingRequest = existingRequestResult.data as Pick<ParentLinkRequestRow, 'id'> | null
  if (existingRequest) {
    return {
      error:
        'You already have a pending link request for this pupil code. Please wait for approval.',
    }
  }

  const { error: insertError } = await adminClient.from('parent_link_requests').insert({
    parent_id: parent.id,
    student_id: student.id,
    school_id: schoolId,
    status: 'pending',
    requested_at: new Date().toISOString(),
  })

  if (insertError) {
    logger.error('submit_link_request_failed', {
      error: (insertError as { message?: string }).message,
    })
    return { error: 'Failed to submit link request. Please try again.' }
  }

  await audit({
    schoolId,
    actorId: parent.id,
    actorEmail: parent.email,
    action: 'parent_link_request.submitted',
    resourceType: 'parent_link_request',
    resourceId: student.id,
  })

  revalidatePath('/parent/children')
  return {
    success: true,
    message: 'Link request submitted. You will be notified when the school approves it.',
  }
}

// ─── Approve Link Request (admin) ────────────────────────────────────────────

export async function approveLinkRequestAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const raw = { requestId: formData.get('requestId') }
  const result = approveLinkRequestSchema.safeParse(raw)
  if (!result.success) return { error: 'Invalid request.' }

  const { requestId } = result.data
  const adminClient = createSupabaseAdminClient()

  // Fetch the request to verify ownership and get parent/student IDs
  const requestResult = await adminClient
    .from('parent_link_requests')
    .select('id, parent_id, student_id, school_id, status')
    .eq('id', requestId)
    .eq('school_id', admin.schoolId)
    .single()

  type RequestSelect = Pick<
    ParentLinkRequestRow,
    'id' | 'parent_id' | 'student_id' | 'school_id' | 'status'
  >
  const request = requestResult.data as RequestSelect | null

  if (!request) return { error: 'Link request not found.' }
  if (request.status !== 'pending') return { error: 'This request has already been processed.' }

  // Create the parent–student link
  const { error: linkError } = await adminClient.from('parent_student_links').insert({
    parent_id: request.parent_id,
    student_id: request.student_id,
    school_id: request.school_id,
    linked_by: admin.id,
    is_active: true,
  })

  if (linkError) {
    const pgCode = (linkError as { code?: string }).code
    // 23505 = unique violation: link already exists — continue to update status
    if (pgCode !== '23505') {
      logger.error('approve_link_request_link_failed', {
        error: (linkError as { message?: string }).message,
        requestId,
      })
      return { error: 'Failed to create the parent–student link. Please try again.' }
    }
  }

  // Update request status
  const { error: updateError } = await adminClient
    .from('parent_link_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('id', requestId)

  if (updateError) {
    logger.error('approve_link_request_status_failed', {
      error: (updateError as { message?: string }).message,
      requestId,
    })
    return { error: 'Link created but failed to update request status. Please refresh.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'parent_link_request.approved',
    resourceType: 'parent_link_request',
    resourceId: requestId,
    metadata: { parent_id: request.parent_id, student_id: request.student_id },
  })

  revalidatePath('/admin/link-requests')
  return { success: true, message: 'Link request approved and parent linked to student.' }
}

// ─── Reject Link Request (admin) ─────────────────────────────────────────────

export async function rejectLinkRequestAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const raw = {
    requestId: formData.get('requestId'),
    rejectionReason: formData.get('rejectionReason'),
  }

  const result = rejectLinkRequestSchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return { fieldErrors: { rejectionReason: fe.rejectionReason?.[0] } }
  }

  const { requestId, rejectionReason } = result.data
  const adminClient = createSupabaseAdminClient()

  const { error } = await adminClient
    .from('parent_link_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
      rejection_reason: rejectionReason,
    })
    .eq('id', requestId)
    .eq('school_id', admin.schoolId)
    .eq('status', 'pending')

  if (error) {
    logger.error('reject_link_request_failed', {
      error: (error as { message?: string }).message,
      requestId,
    })
    return { error: 'Failed to reject request. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'parent_link_request.rejected',
    resourceType: 'parent_link_request',
    resourceId: requestId,
    metadata: { rejection_reason: rejectionReason },
  })

  revalidatePath('/admin/link-requests')
  return { success: true, message: 'Link request rejected.' }
}

// ─── Admin Direct Link (FR-STU-007) ─────────────────────────────────────────
// Admin can link a parent to a student without requiring a prior link request.

export async function adminLinkParentAction(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }

  const raw = {
    studentId: formData.get('studentId'),
    parentEmail: formData.get('parentEmail'),
  }

  const result = adminLinkParentSchema.safeParse(raw)
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return { fieldErrors: { parentEmail: fe.parentEmail?.[0] } }
  }

  const { studentId, parentEmail } = result.data
  const supabase = await createSupabaseServerClient()
  const adminClient = createSupabaseAdminClient()

  // Look up the parent profile by email within this school
  const profileResult = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('email', parentEmail)
    .eq('school_id', admin.schoolId)
    .maybeSingle()

  const profile = profileResult.data as Pick<ProfileRow, 'id' | 'first_name' | 'last_name'> | null

  if (!profile) {
    // Generic message — do not reveal whether the email is registered
    return { error: 'No account found for that email address in this school.' }
  }

  // Check for an existing active link
  const existingResult = await supabase
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', profile.id)
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle()

  const existing = existingResult.data as Pick<ParentStudentLinkRow, 'id'> | null
  if (existing) {
    return { error: 'This parent is already linked to this student.' }
  }

  // Create the link directly
  const { error: linkError } = await adminClient.from('parent_student_links').insert({
    parent_id: profile.id,
    student_id: studentId,
    school_id: admin.schoolId,
    linked_by: admin.id,
    is_active: true,
  })

  if (linkError) {
    const pgCode = (linkError as { code?: string }).code
    if (pgCode === '23505') {
      return { error: 'This parent is already linked to this student.' }
    }
    logger.error('admin_link_parent_failed', {
      error: (linkError as { message?: string }).message,
      studentId,
      parentEmail,
    })
    return { error: 'Failed to create link. Please try again.' }
  }

  await audit({
    schoolId: admin.schoolId,
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'parent_student.linked',
    resourceType: 'parent_student_link',
    resourceId: studentId,
    metadata: { parent_id: profile.id, parent_email: parentEmail },
  })

  // Close any pending link requests from this parent for this student — the link
  // now exists, so leaving them as 'pending' would show a stale status to the parent.
  const { error: closeRequestsError } = await adminClient
    .from('parent_link_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('parent_id', profile.id)
    .eq('student_id', studentId)
    .eq('school_id', admin.schoolId)
    .eq('status', 'pending')

  if (closeRequestsError) {
    logger.warn('admin_link_parent_close_requests_failed', {
      error: (closeRequestsError as { message?: string }).message,
      studentId,
      parentId: profile.id,
    })
  }

  revalidatePath(`/admin/students/${studentId}`)
  revalidatePath('/parent/children')
  return {
    success: true,
    message: `${profile.first_name} ${profile.last_name} linked to this student.`,
  }
}

// ─── Search Children by Name (parent) ────────────────────────────────────────
// Returns first name + last initial + class only — never exposes full last name
// or pupil code in results to limit enumeration risk.

export async function searchStudentsForLinkAction(
  _prev: ChildSearchState,
  formData: FormData,
): Promise<ChildSearchState> {
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'
  const { allowed } = checkRateLimit(`search:${ip}`)
  if (!allowed) {
    return {
      error: 'Too many search requests. Please wait a moment before trying again.',
      searched: false,
    }
  }

  const parent = await requireVerifiedAuth()
  const schoolId = await resolveSchoolId(parent.id, parent.schoolId)
  if (!schoolId)
    return { error: 'No school found. Please contact the school office.', searched: true }

  const raw = { firstName: formData.get('firstName'), lastName: formData.get('lastName') }
  const parsed = childSearchSchema.safeParse(raw)
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors
    return {
      fieldErrors: { firstName: fe.firstName?.[0], lastName: fe.lastName?.[0] },
      searched: false,
    }
  }

  const { firstName, lastName } = parsed.data
  const adminClient = createSupabaseAdminClient()

  type StudentWithClass = {
    id: string
    first_name: string
    last_name: string
    classes: { name: string }[] | { name: string } | null
  }

  const { data: students, error: searchError } = await adminClient
    .from('students')
    .select('id, first_name, last_name, classes(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .ilike('first_name', `%${firstName}%`)
    .ilike('last_name', `%${lastName}%`)
    .limit(10)

  if (searchError) {
    logger.error('search_students_failed', { error: searchError.message })
    return { error: 'Search failed. Please try again.', searched: true }
  }

  const rows = (students as StudentWithClass[] | null) ?? []

  if (rows.length === 0) {
    return { results: [], searched: true }
  }

  // Check existing links and pending requests for this parent in one pass
  const studentIds = rows.map((s) => s.id)

  const [{ data: existingLinks }, { data: pendingRequests }] = await Promise.all([
    adminClient
      .from('parent_student_links')
      .select('student_id')
      .eq('parent_id', parent.id)
      .eq('is_active', true)
      .in('student_id', studentIds),
    adminClient
      .from('parent_link_requests')
      .select('student_id')
      .eq('parent_id', parent.id)
      .eq('status', 'pending')
      .in('student_id', studentIds),
  ])

  const linkedIds = new Set((existingLinks ?? []).map((l: { student_id: string }) => l.student_id))
  const pendingIds = new Set(
    (pendingRequests ?? []).map((r: { student_id: string }) => r.student_id),
  )

  const results: ChildSearchResult[] = rows.map((s) => {
    const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes
    return {
      studentId: s.id,
      firstName: s.first_name,
      lastInitial: s.last_name.charAt(0).toUpperCase(),
      className: cls?.name ?? null,
      status: linkedIds.has(s.id) ? 'linked' : pendingIds.has(s.id) ? 'pending' : 'available',
    }
  })

  return { results, searched: true }
}

// ─── Submit Link Request by Student ID (parent, from search results) ─────────

export async function submitLinkRequestByStudentIdAction(
  studentId: string,
  _prev: StudentActionState,
  _formData: FormData,
): Promise<StudentActionState> {
  const parent = await requireVerifiedAuth()
  const schoolId = await resolveSchoolId(parent.id, parent.schoolId)
  if (!schoolId) return { error: 'No school found. Please contact the school office.' }

  const adminClient = createSupabaseAdminClient()

  // Verify the student exists in this school and is active
  const { data: student } = await adminClient
    .from('students')
    .select('id, is_active')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle()

  const typedStudent = student as Pick<StudentRow, 'id' | 'is_active'> | null
  if (!typedStudent?.is_active) {
    return { error: 'Student not found. Please search again.' }
  }

  // Check for an existing active link
  const { data: existingLink } = await adminClient
    .from('parent_student_links')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle()

  if (existingLink) return { error: 'You are already linked to this child.' }

  // Check for an existing pending request
  const { data: existingRequest } = await adminClient
    .from('parent_link_requests')
    .select('id')
    .eq('parent_id', parent.id)
    .eq('student_id', studentId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingRequest) return { error: 'You already have a pending request for this child.' }

  const { error: insertError } = await adminClient.from('parent_link_requests').insert({
    parent_id: parent.id,
    student_id: studentId,
    school_id: schoolId,
    status: 'pending',
    requested_at: new Date().toISOString(),
  })

  if (insertError) {
    logger.error('submit_link_request_by_id_failed', { error: insertError.message })
    return { error: 'Failed to submit request. Please try again.' }
  }

  await audit({
    schoolId,
    actorId: parent.id,
    actorEmail: parent.email,
    action: 'parent_link_request.submitted',
    resourceType: 'parent_link_request',
    resourceId: studentId,
  })

  revalidatePath('/parent/children')
  return { success: true, message: 'Request submitted. The school will review and approve it.' }
}

// ─── Import Students from CSV (Pro feature) ───────────────────────────────────

export type ImportStudentsState = {
  error?: string
  summary?: {
    created: number
    skipped: number
    errors: { line: number; message: string }[]
  }
} | null

const MAX_IMPORT_ROWS = 500

export async function importStudentsAction(
  _prev: ImportStudentsState,
  formData: FormData,
): Promise<ImportStudentsState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No school is associated with your account.' }
  // CSV import is a Pro feature — redirects to /pricing if the school isn't Pro.
  await requireFeature('csv_import', admin.schoolId)

  const file = formData.get('file')
  const text = file instanceof File ? await file.text() : ''
  if (!text.trim()) return { error: 'Please choose a CSV file to import.' }

  const parsed = parseStudentCsv(text)
  if (parsed.error) return { error: parsed.error }
  if (parsed.rows.length === 0) return { error: 'No student rows were found in the file.' }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `Too many rows (${parsed.rows.length}). Import up to ${MAX_IMPORT_ROWS} at a time.`,
    }
  }

  const adminClient = createSupabaseAdminClient()

  // Map class name (lowercased) → id for this school's active classes.
  const { data: classRows } = await adminClient
    .from('classes')
    .select('id, name')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
  const classByName = new Map<string, string>()
  for (const c of (classRows as { id: string; name: string }[] | null) ?? []) {
    classByName.set(c.name.trim().toLowerCase(), c.id)
  }

  // Existing students for in-school de-duplication (first + last + class).
  const { data: existing } = await adminClient
    .from('students')
    .select('first_name, last_name, class_id')
    .eq('school_id', admin.schoolId)
  const seen = new Set<string>()
  const keyOf = (first: string, last: string, classId: string) =>
    `${first.toLowerCase()}|${last.toLowerCase()}|${classId}`
  for (const s of (existing as
    | { first_name: string; last_name: string; class_id: string }[]
    | null) ?? []) {
    seen.add(keyOf(s.first_name, s.last_name, s.class_id))
  }

  const prefix = schoolCodePrefix(admin.schoolName ?? '')
  const errors: { line: number; message: string }[] = []
  let created = 0
  let skipped = 0

  for (const row of parsed.rows) {
    if (!row.firstName || !row.lastName || !row.className) {
      errors.push({ line: row.line, message: 'Missing first name, last name or class.' })
      continue
    }
    const classId = classByName.get(row.className.toLowerCase())
    if (!classId) {
      errors.push({ line: row.line, message: `Class "${row.className}" not found at your school.` })
      continue
    }
    const key = keyOf(row.firstName, row.lastName, classId)
    if (seen.has(key)) {
      skipped++
      continue
    }

    const codeResult = await adminClient.rpc('generate_pupil_code', { p_prefix: prefix })
    const pupilCode = codeResult.data as string | null
    if (!pupilCode) {
      errors.push({ line: row.line, message: 'Could not generate a pupil code.' })
      continue
    }

    const insertResult = await adminClient.from('students').insert({
      school_id: admin.schoolId,
      first_name: row.firstName,
      last_name: row.lastName,
      class_id: classId,
      pupil_payment_code: pupilCode,
      is_active: true,
    })
    if (insertResult.error) {
      logger.error('import_student_insert_failed', {
        line: row.line,
        error: insertResult.error.message,
      })
      errors.push({ line: row.line, message: 'Could not save this student.' })
      continue
    }
    seen.add(key)
    created++
  }

  if (created > 0) {
    await audit({
      schoolId: admin.schoolId,
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'student.created',
      resourceType: 'student',
      metadata: { source: 'csv_import', created, skipped, error_count: errors.length },
    })
    revalidatePath('/admin/students')
  }

  return { summary: { created, skipped, errors } }
}
