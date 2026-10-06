import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { vettingStatus, needsAttention, type VettingStatus } from './vetting'

export interface VettingRow {
  teacherId: string
  name: string
  email: string | null
  reference: string | null
  vettingDate: string | null
  expiryDate: string | null
  status: VettingStatus
}

export interface VettingOverview {
  asOf: string
  rows: VettingRow[]
  /** Count of staff needing attention (not recorded, expired, or renewal due). */
  attention: number
  /** False if the garda_vetting table isn't there yet (migration 094 unapplied). */
  tableReady: boolean
}

type VettingRecord = {
  teacher_id: string
  reference: string | null
  vetting_date: string | null
  expiry_date: string | null
}

/**
 * Per-staff Garda vetting overview: every active teacher with their current vetting record
 * (if any) and derived status, sorted by name. School-scoped. Tolerates the garda_vetting
 * table being absent (migration 094 not yet applied) — then every teacher reads as
 * "not recorded" and `tableReady` is false.
 */
export async function getVettingOverview(
  schoolId: string,
  asOfISO: string,
): Promise<VettingOverview> {
  const db = createSupabaseAdminClient()

  const { data: teacherData } = await db
    .from('teachers')
    .select('id, first_name, last_name, email')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('first_name')
    .order('last_name')

  const teachers =
    (teacherData as
      | { id: string; first_name: string | null; last_name: string | null; email: string | null }[]
      | null) ?? []

  const { data: vettingData, error } = await db
    .from('garda_vetting')
    .select('teacher_id, reference, vetting_date, expiry_date')
    .eq('school_id', schoolId)

  const tableReady = !error
  const byTeacher = new Map<string, VettingRecord>()
  for (const r of (vettingData as VettingRecord[] | null) ?? []) byTeacher.set(r.teacher_id, r)

  const rows: VettingRow[] = teachers.map((t) => {
    const rec = byTeacher.get(t.id)
    const status: VettingStatus = rec ? vettingStatus(rec.expiry_date, asOfISO) : 'missing'
    return {
      teacherId: t.id,
      name: [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Staff member',
      email: t.email ?? null,
      reference: rec?.reference ?? null,
      vettingDate: rec?.vetting_date ?? null,
      expiryDate: rec?.expiry_date ?? null,
      status,
    }
  })

  return {
    asOf: asOfISO,
    rows,
    attention: rows.filter((r) => needsAttention(r.status)).length,
    tableReady,
  }
}
