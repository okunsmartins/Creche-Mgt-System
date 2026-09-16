import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import type { SessionUser } from '@/types'
import type { ProfileRow, UserRoleRow, RoleRow } from '@/types/database'

// Column sub-sets we actually SELECT in this function
type ProfileSelect = Pick<ProfileRow, 'first_name' | 'last_name' | 'school_id'>
type UserRoleSelect = Pick<UserRoleRow, 'role_id'>
type RoleSelect = Pick<RoleRow, 'name'>

/**
 * Returns the authenticated user with profile, roles and permissions,
 * or null if there is no valid session.
 *
 * Uses getUser() (server-verified JWT) — never getSession() (client trust).
 *
 * Type assertions below are deliberate: the Supabase TypeScript generic
 * inference can fail for manually-written Database types. The shapes are
 * safe — they exactly match what the SELECT strings fetch.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Profile — has school_id needed for permission lookup
  // Use admin client to bypass RLS for own-profile reads (safe: server-side only)
  const adminClient = createSupabaseAdminClient()
  const profileResult = await adminClient
    .from('profiles')
    .select('first_name, last_name, school_id')
    .eq('id', user.id)
    .single()

  const profile = profileResult.data as ProfileSelect | null

  // Role IDs assigned to this user — use admin client to bypass RLS.
  // auth.uid() can evaluate to NULL in certain Server Component contexts
  // (supabase.auth.getUser() verifies the JWT but the anon client's cookie
  // session may not be hydrated in time for RLS evaluation). Safe to use
  // adminClient here: we are on the server and scope the query to user.id
  // which was already verified above via getUser().
  const userRolesResult = await adminClient
    .from('user_roles')
    .select('role_id')
    .eq('user_id', user.id)

  const userRoles = userRolesResult.data as UserRoleSelect[] | null

  const schoolId = profile?.school_id ?? null
  const roleIds = (userRoles ?? []).map((r) => r.role_id)

  // Force-password-change flag. Defensive separate read so the session still
  // works if migration 036 hasn't been applied yet (a missing column returns an
  // error + null data → defaults to false).
  const mcResult = await adminClient
    .from('profiles')
    .select('must_change_password')
    .eq('id', user.id)
    .maybeSingle()
  const mustChangePassword =
    (mcResult.data as { must_change_password?: boolean } | null)?.must_change_password ?? false

  // Resolve the user's school display name (for dynamic tenant branding).
  let schoolName: string | null = null
  if (schoolId) {
    const schoolResult = await adminClient
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .maybeSingle()
    schoolName = (schoolResult.data as { name: string } | null)?.name ?? null
  }

  // Resolve role names — admin client for same reason as above
  let roles: string[] = []
  if (roleIds.length > 0) {
    const rolesResult = await adminClient.from('roles').select('name').in('id', roleIds)
    roles = ((rolesResult.data as RoleSelect[] | null) ?? []).map((r) => r.name)
  }

  // Resolve permissions for this user's school.
  let permissions: string[] = []
  if (schoolId) {
    // @ts-expect-error — Supabase rpc() inference fails with manual Database types:
    // Schema resolves to never so args becomes undefined. Correct at runtime.
    const permsResult = await supabase.rpc('get_user_permissions', {
      p_user_id: user.id,
      p_school_id: schoolId,
    })
    permissions = (permsResult.data as string[] | null) ?? []
  }

  return {
    id: user.id,
    email: user.email ?? '',
    emailVerified: !!user.email_confirmed_at,
    profile: profile ? { firstName: profile.first_name, lastName: profile.last_name } : null,
    roles,
    permissions,
    schoolId,
    schoolName,
    mustChangePassword,
  }
}
