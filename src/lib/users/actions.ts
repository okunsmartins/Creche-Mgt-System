'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

export type UserActionState = { error?: string | undefined; success?: boolean | undefined }

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
