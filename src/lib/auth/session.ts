import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import type { SessionUser } from '@/types'
import type { ProfileRow, UserRoleRow, RoleRow } from '@/types/database'
import { isPlatformOwner } from '@/lib/platform/owner'
import type { AdminMfaState } from './mfa-policy'

const ADMIN_ROLE_NAMES = ['super_admin', 'school_admin', 'finance_admin']

// Column sub-sets we actually SELECT in this function
type ProfileSelect = Pick<ProfileRow, 'first_name' | 'last_name' | 'school_id'>
type UserRoleSelect = Pick<UserRoleRow, 'role_id' | 'created_at'>
type RoleSelect = Pick<RoleRow, 'id' | 'name'>

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
    .select('role_id, created_at')
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
  let roleRows: RoleSelect[] = []
  if (roleIds.length > 0) {
    const rolesResult = await adminClient.from('roles').select('id, name').in('id', roleIds)
    roleRows = (rolesResult.data as RoleSelect[] | null) ?? []
    roles = roleRows.map((r) => r.name)
  }

  // Two-step sign-in state for privileged accounts only (admins + platform owner).
  let mfa: AdminMfaState | null = null
  const adminRoleIds = new Set(
    roleRows.filter((r) => ADMIN_ROLE_NAMES.includes(r.name)).map((r) => r.id),
  )
  const owner = isPlatformOwner({ email: user.email ?? '' })
  if (adminRoleIds.size > 0 || owner) {
    const adminSince = (userRoles ?? [])
      .filter((r) => adminRoleIds.has(r.role_id))
      .map((r) => r.created_at)
      .sort()[0]
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    mfa = {
      currentLevel: aal?.currentLevel ?? null,
      nextLevel: aal?.nextLevel ?? null,
      privilegedSince: adminSince ?? (owner ? (user.created_at ?? null) : null),
    }
  }

  // Resolve permissions for this user's school.
  let permissions: string[] = []
  if (schoolId) {
    // Service role, like the profile / role reads above: migration 114 only lets a
    // signed-in user ask about THEMSELVES, and the server asks for the user it has
    // just verified with getUser(). Same answer either way; no dependency on the
    // migration being applied first.
    const permsResult = await adminClient.rpc('get_user_permissions', {
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
    mfa,
  }
}
