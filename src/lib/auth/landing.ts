// Where a signed-in privileged user "lives". Shared by the two-step sign-in pages and
// actions so they agree: the platform owner lands on /platform (which links on to their
// own crèche dashboard when they have one); crèche admins land on the admin dashboard.
// Pure (no I/O), so it's unit-tested.

import { isPlatformOwner } from '@/lib/platform/owner'
import type { SessionUser } from '@/types'

const ADMIN_ROLE_NAMES = ['super_admin', 'school_admin', 'finance_admin']

export function privilegedHomeFor(user: Pick<SessionUser, 'email' | 'roles'>): string {
  if (isPlatformOwner(user)) return '/platform'
  if (user.roles.some((r) => ADMIN_ROLE_NAMES.includes(r))) return '/admin/dashboard'
  return '/'
}
