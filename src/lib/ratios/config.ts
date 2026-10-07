import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { REFERENCE_EY_RATIOS, type EyRatioBand } from './ratio'

type BandRow = {
  label: string
  min_months: number
  max_months: number
  children_per_adult: number
}

/**
 * The crèche's configured ratio bands, or the Irish reference defaults when none are
 * saved yet (or the table isn't there pre-migration). School-scoped. Always returns a
 * usable band set so the ratio engine works out of the box.
 */
export async function getRatioBands(schoolId: string): Promise<EyRatioBand[]> {
  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('ratio_bands')
    .select('label, min_months, max_months, children_per_adult')
    .eq('school_id', schoolId)
    .order('display_order')

  const rows = (data as BandRow[] | null) ?? []
  if (error || rows.length === 0) return REFERENCE_EY_RATIOS.map((b) => ({ ...b }))

  return rows.map((r) => ({
    label: r.label,
    minMonths: r.min_months,
    maxMonths: r.max_months,
    childrenPerAdult: r.children_per_adult,
  }))
}

/** True when the crèche has saved its own bands (vs running on the reference defaults). */
export async function hasCustomRatioBands(schoolId: string): Promise<boolean> {
  const db = createSupabaseAdminClient()
  const { count } = await db
    .from('ratio_bands')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
  return (count ?? 0) > 0
}
