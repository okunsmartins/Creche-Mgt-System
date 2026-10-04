import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { SessionUser } from '@/types'

/** Whether the Funding & Hive Centre is enabled for this tenant (ships dark). */
export async function fundingEnabled(schoolId: string): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('tenant_funding_settings')
    .select('hive_centre_enabled')
    .eq('school_id', schoolId)
    .maybeSingle()
  return Boolean((data as { hive_centre_enabled: boolean } | null)?.hive_centre_enabled)
}

/**
 * Gate for the Funding & Hive Centre: an admin with `funding.view`, in a tenant that
 * has the feature enabled. Permission-missing → back to the dashboard; feature-off →
 * notFound() so the module stays hidden for tenants not opted in.
 */
export async function requireFundingAdmin(): Promise<SessionUser> {
  const user = await requireAdmin()
  if (!user.permissions.includes('funding.view')) redirect('/admin/dashboard')
  if (!user.schoolId || !(await fundingEnabled(user.schoolId))) notFound()
  return user
}

/** True when the user holds a specific funding permission. */
export function hasFundingPermission(user: SessionUser, permission: string): boolean {
  return user.permissions.includes(permission)
}
