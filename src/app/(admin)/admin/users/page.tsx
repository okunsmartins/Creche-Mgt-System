import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { ChangeRoleForm } from '@/components/users/ChangeRoleForm'
import type { UserRole, RoleRow, ProfileRow } from '@/types/database'

export const metadata: Metadata = { title: 'Users & Roles' }

type RoleOption = Pick<RoleRow, 'id' | 'name' | 'display_name' | 'description'>

type UserEntry = {
  userId: string
  profile: Pick<
    ProfileRow,
    'first_name' | 'last_name' | 'email' | 'email_verified' | 'is_active' | 'created_at'
  > | null
  roles: { id: string; name: UserRole; display_name: string }[]
  latestAssignment: string
}

const ROLE_BADGE: Record<UserRole, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  super_admin: 'error',
  school_admin: 'info',
  finance_admin: 'warning',
  teacher: 'success',
  parent: 'default',
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const supabase = createSupabaseAdminClient()
  const isSuperAdmin = admin.roles.includes('super_admin')

  // Parallel fetches: role assignments for this school + all role definitions
  const [roleAssignmentsResult, allRolesResult] = await Promise.all([
    supabase
      .from('user_roles')
      .select('id, user_id, created_at, roles(id, name, display_name)')
      .eq('school_id', admin.schoolId)
      .order('created_at', { ascending: false }),
    supabase.from('roles').select('id, name, display_name, description').order('name'),
  ])

  type RawAssignment = {
    id: string
    user_id: string
    created_at: string
    roles: { id: string; name: UserRole; display_name: string } | null
  }

  const rawAssignments = (roleAssignmentsResult.data as RawAssignment[] | null) ?? []
  const allRoles = (allRolesResult.data as RoleOption[] | null) ?? []

  // Group assignments by user_id
  const byUser = new Map<string, UserEntry>()
  for (const row of rawAssignments) {
    const existing = byUser.get(row.user_id)
    if (existing) {
      if (row.roles) existing.roles.push(row.roles)
      if (row.created_at > existing.latestAssignment) {
        existing.latestAssignment = row.created_at
      }
    } else {
      byUser.set(row.user_id, {
        userId: row.user_id,
        profile: null,
        roles: row.roles ? [row.roles] : [],
        latestAssignment: row.created_at,
      })
    }
  }

  // Fetch profiles for all user IDs
  const userIds = [...byUser.keys()]
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, email_verified, is_active, created_at')
      .in('id', userIds)

    type ProfileWithId = Pick<
      ProfileRow,
      'first_name' | 'last_name' | 'email' | 'email_verified' | 'is_active' | 'created_at'
    > & { id: string }

    for (const p of (profiles as ProfileWithId[] | null) ?? []) {
      const entry = byUser.get(p.id)
      if (entry) {
        const { id: _id, ...rest } = p
        entry.profile = rest
      }
    }
  }

  // Sort: admins first, then by name
  const ROLE_ORDER: Record<string, number> = {
    super_admin: 0,
    school_admin: 1,
    finance_admin: 2,
    teacher: 3,
    parent: 4,
  }
  const users = [...byUser.values()].sort((a, b) => {
    const aOrder = Math.min(...a.roles.map((r) => ROLE_ORDER[r.name] ?? 99))
    const bOrder = Math.min(...b.roles.map((r) => ROLE_ORDER[r.name] ?? 99))
    if (aOrder !== bOrder) return aOrder - bOrder
    const aName = a.profile ? `${a.profile.last_name} ${a.profile.first_name}` : ''
    const bName = b.profile ? `${b.profile.last_name} ${b.profile.first_name}` : ''
    return aName.localeCompare(bName)
  })

  // Role options for the change-role dropdown (exclude parent for admin actions)
  const staffRoles = allRoles
    .filter((r) => r.name !== 'parent')
    .map((r) => ({ name: r.name as UserRole, displayName: r.display_name }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users &amp; Roles</h1>
          <p className="mt-1 text-sm text-text-muted">
            {users.length} user{users.length !== 1 ? 's' : ''} with role assignments for this
            school.
          </p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-text-muted">No users found with role assignments.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  User
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted sm:table-cell">
                  Email
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted md:table-cell">
                  Role(s)
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted md:table-cell">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted lg:table-cell">
                  Member since
                </th>
                {isSuperAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Change role
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const isCurrentUser = u.userId === admin.id
                const primaryRole = u.roles[0] ?? null
                const displayName = u.profile
                  ? `${u.profile.first_name} ${u.profile.last_name}`
                  : 'Unknown user'
                const initials = u.profile
                  ? `${u.profile.first_name[0] ?? ''}${u.profile.last_name[0] ?? ''}`.toUpperCase()
                  : '??'

                return (
                  <tr key={u.userId} className="hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">
                            {displayName}
                            {isCurrentUser && (
                              <span className="ml-2 rounded-full bg-surface px-1.5 py-0.5 text-xs text-text-muted ring-1 ring-border">
                                you
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-text-muted sm:hidden">
                            {u.profile?.email ?? '—'}
                          </p>
                          <p className="mt-0.5 flex flex-wrap gap-1 md:hidden">
                            {u.roles.map((r) => (
                              <Badge key={r.id} variant={ROLE_BADGE[r.name] ?? 'default'}>
                                {r.display_name}
                              </Badge>
                            ))}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                      {u.profile?.email ?? '—'}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length > 0 ? (
                          u.roles.map((r) => (
                            <Badge key={r.id} variant={ROLE_BADGE[r.name] ?? 'default'}>
                              {r.display_name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {u.profile?.email_verified ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <Badge variant="warning">Unverified</Badge>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-text-muted lg:table-cell">
                      {u.profile?.created_at
                        ? new Date(u.profile.created_at).toLocaleDateString('en-IE')
                        : '—'}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        {isCurrentUser ? (
                          <span className="text-xs text-text-muted">Cannot change own role</span>
                        ) : (
                          <ChangeRoleForm
                            targetUserId={u.userId}
                            currentRole={primaryRole?.name ?? null}
                            roles={staffRoles}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role reference */}
      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-text-primary">Role reference</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allRoles.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={ROLE_BADGE[r.name as UserRole] ?? 'default'}>
                  {r.display_name}
                </Badge>
              </div>
              <p className="text-xs text-text-muted">{r.description ?? 'No description.'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
