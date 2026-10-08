'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

export type UserActionState = { error?: string | undefined; success?: boolean | undefined }

const ADMIN_ROLE_NAMES = ['super_admin', 'school_admin', 'finance_admin']

/**
 * Assign a role to a staff member by email — the way to give a registered staff member
 * (e.g. a teacher) their role, including users who have no role yet (and so don't appear in
 * the list). School-scoped, verify-then-write. A school_admin may grant non-admin roles
 * (teacher); granting an admin-level role requires super_admin (no privilege escalation).
 */
export async function assignRoleByEmailAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No crèche is associated with your account.' }
  const canManage = admin.roles.includes('super_admin') || admin.roles.includes('school_admin')
  if (!canManage) return { error: 'You do not have permission to assign roles.' }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? ''
  const roleName = (formData.get('roleName') as string | null) ?? ''
  if (!email) return { error: 'Enter the staff member’s email.' }
  if (!roleName) return { error: 'Select a role.' }

  if (ADMIN_ROLE_NAMES.includes(roleName) && !admin.roles.includes('super_admin'))
    return { error: 'Only a super administrator can grant an admin-level role.' }

  const supabase = createSupabaseAdminClient()

  const { data: role } = await supabase
    .from('roles')
    .select('id, display_name')
    .eq('name', roleName)
    .maybeSingle()
  if (!role) return { error: 'Invalid role selected.' }

  // Find the registered user by email.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, school_id, first_name, last_name, email')
    .eq('email', email)
    .maybeSingle()
  const target = profile as {
    id: string
    school_id: string | null
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  if (!target)
    return { error: 'No registered user with that email. Ask them to sign up first, then assign.' }

  // Tenant safety: only attach users who belong to this crèche or have no crèche yet.
  if (target.school_id && target.school_id !== admin.schoolId)
    return { error: 'That user belongs to another crèche.' }
  if (!target.school_id) {
    await supabase.from('profiles').update({ school_id: admin.schoolId }).eq('id', target.id)
  }

  // Replace this school's role assignments for the user with the new role.
  await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', target.id)
    .eq('school_id', admin.schoolId)
  const { error: insertErr } = await supabase.from('user_roles').insert({
    user_id: target.id,
    role_id: (role as { id: string }).id,
    school_id: admin.schoolId,
    granted_by: admin.id,
  })
  if (insertErr) {
    logger.error('assign_role_insert_failed', {
      schoolId: admin.schoolId,
      error: insertErr.message,
    })
    return { error: 'Could not assign the role. Please try again.' }
  }

  await supabase.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'role.assigned',
    resource_type: 'user',
    resource_id: target.id,
    metadata: { target_email: target.email, new_role: roleName },
  })

  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * Replace all role assignments for a user at this school with a single new role.
 * Only super_admin may call this.
 */
export async function changeUserRoleAction(
  targetUserId: string,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin()

  if (!admin.roles.includes('super_admin')) {
    return { error: 'Only super administrators can change user roles.' }
  }
  if (!admin.schoolId) {
    return { error: 'No school is associated with your account.' }
  }

  const newRoleName = formData.get('roleName') as string | null
  if (!newRoleName) {
    return { error: 'Please select a role.' }
  }

  const supabase = createSupabaseAdminClient()

  // Resolve role by name
  const { data: role, error: roleErr } = await supabase
    .from('roles')
    .select('id, display_name')
    .eq('name', newRoleName)
    .single()

  if (roleErr || !role) {
    return { error: 'Invalid role selected.' }
  }

  // Remove existing roles for this user at this school
  const { error: deleteErr } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('school_id', admin.schoolId)

  if (deleteErr) {
    logger.error('change_role_delete_failed', { message: deleteErr.message, code: deleteErr.code })
    return { error: 'Failed to update role. Please try again.' }
  }

  // Assign new role
  const { error: insertErr } = await supabase.from('user_roles').insert({
    user_id: targetUserId,
    role_id: role.id,
    school_id: admin.schoolId,
    granted_by: admin.id,
  })

  if (insertErr) {
    logger.error('change_role_insert_failed', { message: insertErr.message, code: insertErr.code })
    return { error: 'Failed to assign new role. Please try again.' }
  }

  // Audit log — fetch target profile for context (best-effort)
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', targetUserId)
    .single()

  await supabase.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'role.changed',
    resource_type: 'user',
    resource_id: targetUserId,
    metadata: {
      target_email: targetProfile?.email ?? null,
      target_name: targetProfile ? `${targetProfile.first_name} ${targetProfile.last_name}` : null,
      new_role: newRoleName,
      new_role_display: (role as { id: string; display_name: string }).display_name,
    },
  })

  revalidatePath('/admin/users')
  return { success: true }
}
