import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

type Db = ReturnType<typeof createSupabaseAdminClient>

/**
 * The email of the account that set up this crèche's portal. Creating a portal
 * (lib/tenant/provision.ts) makes its creator the crèche's FIRST admin, so the
 * owner is the earliest school_admin / super_admin assignment for the school.
 * Returns null if that account is missing or deactivated. School-scoped.
 */
export async function getPortalOwnerEmail(db: Db, schoolId: string): Promise<string | null> {
  const { data: roleRows } = await db
    .from('roles')
    .select('id')
    .in('name', ['school_admin', 'super_admin'])
  const roleIds = ((roleRows as { id: string }[] | null) ?? []).map((r) => r.id)
  if (!roleIds.length) return null

  const { data: first } = await db
    .from('user_roles')
    .select('user_id')
    .eq('school_id', schoolId)
    .in('role_id', roleIds)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const userId = (first as { user_id: string } | null)?.user_id
  if (!userId) return null

  const { data: profile } = await db
    .from('profiles')
    .select('email, is_active')
    .eq('id', userId)
    .maybeSingle()
  const p = profile as { email: string | null; is_active: boolean } | null
  return p?.is_active && p.email ? p.email : null
}
