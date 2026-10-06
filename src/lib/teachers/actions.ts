'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { teacherSchema, type TeacherActionState } from './schemas'
import { onStaffOrRoomChanged } from '@/lib/funding/events'
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
    resource_type: 'teacher',
    resource_id: params.resourceId ?? null,
    metadata: params.metadata ?? null,
    correlation_id: null,
    ip_address: null,
  })
  if (error) logger.error('audit_log_failed', { action: params.action, error: error.message })
}

export async function createTeacherAction(
  _prev: TeacherActionState,
  formData: FormData,
): Promise<TeacherActionState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }

  const result = teacherSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    displayName: formData.get('displayName') ?? '',
    email: formData.get('email') ?? '',
    isActive: formData.get('isActive') ?? 'true',
  })

  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      error: 'Please fix the errors below.',
      fieldErrors: {
        firstName: fe.firstName?.[0],
        lastName: fe.lastName?.[0],
        displayName: fe.displayName?.[0],
        email: fe.email?.[0],
      },
    }
  }

  const { firstName, lastName, displayName, email, isActive } = result.data
  const adminClient = createSupabaseAdminClient()

  const { data, error } = await adminClient
    .from('teachers')
    .insert({
      school_id: user.schoolId,
      first_name: firstName,
      last_name: lastName,
      display_name: displayName ?? null,
      email: email ?? null,
      is_active: isActive,
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error('create_teacher_failed', { error: error?.message })
    return { error: 'Could not create teacher. Please try again.' }
  }

  const teacherId = (data as { id: string }).id

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'teacher.created',
    resourceId: teacherId,
    metadata: { first_name: firstName, last_name: lastName },
  })

  revalidatePath('/admin/teachers')
  await onStaffOrRoomChanged(user.schoolId)
  return { success: true, teacherId }
}

export async function updateTeacherAction(
  teacherId: string,
  _prev: TeacherActionState,
  formData: FormData,
): Promise<TeacherActionState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }

  const result = teacherSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    displayName: formData.get('displayName') ?? '',
    email: formData.get('email') ?? '',
    isActive: formData.get('isActive') ?? 'true',
  })

  if (!result.success) {
    const fe = result.error.flatten().fieldErrors
    return {
      error: 'Please fix the errors below.',
      fieldErrors: {
        firstName: fe.firstName?.[0],
        lastName: fe.lastName?.[0],
        displayName: fe.displayName?.[0],
        email: fe.email?.[0],
      },
    }
  }

  const { firstName, lastName, displayName, email, isActive } = result.data
  const adminClient = createSupabaseAdminClient()

  const { error } = await adminClient
    .from('teachers')
    .update({
      first_name: firstName,
      last_name: lastName,
      display_name: displayName ?? null,
      email: email ?? null,
      is_active: isActive,
    })
    .eq('id', teacherId)
    .eq('school_id', user.schoolId)

  if (error) {
    logger.error('update_teacher_failed', { teacherId, error: error.message })
    return { error: 'Could not update teacher. Please try again.' }
  }

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: isActive ? 'teacher.updated' : 'teacher.deactivated',
    resourceId: teacherId,
    metadata: { first_name: firstName, last_name: lastName, is_active: isActive },
  })

  revalidatePath('/admin/teachers')
  revalidatePath(`/admin/teachers/${teacherId}`)
  await onStaffOrRoomChanged(user.schoolId)
  return { success: true, teacherId }
}

// ─── Create Teacher Login (invite) ────────────────────────────────────────────

/** Random temporary password (no SMTP needed — admin shares it with the teacher). */
function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `Tp-${hex}`
}

export type TeacherLoginState = {
  ok?: boolean
  email?: string
  tempPassword?: string
  error?: string
} | null

/**
 * Provisions a login for an existing teacher record: creates a confirmed auth
 * account attached to the admin's school, grants the teacher role, and links it
 * to the teacher record. Returns a one-time temporary password for the admin to
 * share. Scoped to the admin's own school (multi-tenant safe).
 */
export async function createTeacherLoginAction(
  teacherId: string,
  _prev: TeacherLoginState,
  _formData: FormData,
): Promise<TeacherLoginState> {
  const user = await requireAdmin()
  if (!user.schoolId) return { error: 'No school is associated with your account.' }
  const adminClient = createSupabaseAdminClient()

  // 1. Fetch the teacher record, scoped to this admin's school.
  const { data: teacherData } = await adminClient
    .from('teachers')
    .select('id, first_name, last_name, email, profile_id')
    .eq('id', teacherId)
    .eq('school_id', user.schoolId)
    .maybeSingle()
  const teacher = teacherData as {
    id: string
    first_name: string
    last_name: string
    email: string | null
    profile_id: string | null
  } | null
  if (!teacher) return { error: 'Teacher not found.' }
  if (!teacher.email) return { error: 'Add an email address to this teacher first.' }
  if (teacher.profile_id) return { error: 'This teacher already has a login.' }

  // 2. Resolve the teacher role id.
  const { data: roleRow } = await adminClient
    .from('roles')
    .select('id')
    .eq('name', 'teacher')
    .single()
  const roleId = (roleRow as { id: string } | null)?.id
  if (!roleId) return { error: 'Teacher role is not configured.' }

  // 3. Create the confirmed auth account (no verification email required).
  const tempPassword = generateTempPassword()
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: teacher.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { first_name: teacher.first_name, last_name: teacher.last_name },
  })
  if (createErr || !created?.user) {
    logger.warn('create_teacher_login_failed', { reason: createErr?.message })
    return {
      error: createErr?.message?.toLowerCase().includes('already')
        ? 'An account with this email already exists.'
        : 'Could not create the login. Please try again.',
    }
  }
  const newUserId = created.user.id

  // 4. Attach the profile to the school (handle_new_user created it with null school_id).
  await adminClient
    .from('profiles')
    .update({
      school_id: user.schoolId,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      must_change_password: true,
    })
    .eq('id', newUserId)

  // 5. Grant the teacher role and 6. link the teacher record.
  const { error: roleErr } = await adminClient
    .from('user_roles')
    .insert({ user_id: newUserId, role_id: roleId, school_id: user.schoolId })
  const { error: linkErr } = await adminClient
    .from('teachers')
    .update({ profile_id: newUserId })
    .eq('id', teacher.id)

  if (roleErr || linkErr) {
    logger.error('create_teacher_login_wireup_failed', {
      roleErr: roleErr?.message,
      linkErr: linkErr?.message,
    })
    return { error: 'Login created but setup is incomplete. Contact support.' }
  }

  await audit({
    schoolId: user.schoolId,
    actorId: user.id,
    actorEmail: user.email,
    action: 'teacher.updated',
    resourceId: teacher.id,
    metadata: { login_created: true },
  })

  revalidatePath('/admin/teachers')
  revalidatePath(`/admin/teachers/${teacher.id}`)
  return { ok: true, email: teacher.email, tempPassword }
}
