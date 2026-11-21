// Owner view: every crèche admin and whether they've set up two-step sign-in.
// Platform-owner only (the /platform layout guards the page that calls this).

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { adminMfaDecision, type AdminMfaState } from '@/lib/auth/mfa-policy'

const ADMIN_ROLE_NAMES = ['super_admin', 'school_admin', 'finance_admin']

export interface AdminMfaRow {
  userId: string
  name: string
  email: string
  schools: string[]
  /** Verified authenticator set up. */
  enrolled: boolean
  /** Not set up: days left in the grace period, or 0 when it's over. */
  graceDaysLeft: number | null
}

export async function getAdminMfaRows(): Promise<AdminMfaRow[]> {
  const db = createSupabaseAdminClient()
  const { data: roleData } = await db.from('roles').select('id, name').in('name', ADMIN_ROLE_NAMES)
  const roleIds = ((roleData ?? []) as { id: string }[]).map((r) => r.id)
  if (roleIds.length === 0) return []

  const { data: urData } = await db
    .from('user_roles')
    .select('user_id, school_id, created_at')
    .in('role_id', roleIds)
  const userRoles = (urData ?? []) as { user_id: string; school_id: string; created_at: string }[]
  const userIds = [...new Set(userRoles.map((r) => r.user_id))]
  if (userIds.length === 0) return []

  const schoolIds = [...new Set(userRoles.map((r) => r.school_id))]
  const [{ data: profData }, { data: schoolData }] = await Promise.all([
    db.from('profiles').select('id, first_name, last_name').in('id', userIds),
    db.from('schools').select('id, name').in('id', schoolIds),
  ])
  const names = new Map(
    ((profData ?? []) as { id: string; first_name: string; last_name: string }[]).map((p) => [
      p.id,
      `${p.first_name} ${p.last_name}`.trim(),
    ]),
  )
  const schoolName = new Map(
    ((schoolData ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  )

  const rows: AdminMfaRow[] = []
  for (const userId of userIds) {
    const mine = userRoles.filter((r) => r.user_id === userId)
    const [{ data: u }, { data: f }] = await Promise.all([
      db.auth.admin.getUserById(userId),
      db.auth.admin.mfa.listFactors({ userId }),
    ])
    const enrolled = (f?.factors ?? []).some(
      (x) => x.factor_type === 'totp' && x.status === 'verified',
    )
    const state: AdminMfaState = {
      currentLevel: null,
      nextLevel: enrolled ? 'aal2' : 'aal1',
      privilegedSince: mine.map((r) => r.created_at).sort()[0] ?? null,
    }
    const d = adminMfaDecision(state)
    rows.push({
      userId,
      name: names.get(userId) || '—',
      email: u?.user?.email ?? '—',
      schools: [...new Set(mine.map((r) => schoolName.get(r.school_id) ?? '—'))],
      enrolled,
      graceDaysLeft: enrolled ? null : d.kind === 'grace' ? d.daysLeft : 0,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}
