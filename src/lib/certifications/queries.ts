import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  certificationStatus,
  certificationNeedsAttention,
  isCertificationKind,
  type CertificationKind,
  type CertificationStatus,
} from './certifications'

export interface CertificationRow {
  id: string
  teacherId: string
  teacherName: string
  kind: CertificationKind
  name: string
  reference: string | null
  issuedDate: string | null
  expiryDate: string | null
  notes: string | null
  status: CertificationStatus
}

export interface CertificationOverview {
  asOf: string
  rows: CertificationRow[]
  /** Count needing attention (expired or expiring). */
  attention: number
  /** False if staff_certifications isn't there yet (migration 096 unapplied). */
  tableReady: boolean
}

type Rec = {
  id: string
  teacher_id: string
  kind: string
  name: string
  reference: string | null
  issued_date: string | null
  expiry_date: string | null
  notes: string | null
  teachers: { first_name: string | null; last_name: string | null } | null
}

// Order: attention first (expired, then expiring), then valid, then no-expiry;
// within a status, soonest expiry first, then name.
const STATUS_ORDER: Record<CertificationStatus, number> = {
  expired: 0,
  expiring: 1,
  valid: 2,
  'no-expiry': 3,
}

/**
 * Staff certifications (qualifications/training) with derived status, sorted by urgency.
 * School-scoped. Tolerates staff_certifications being absent (migration 096 unapplied) —
 * then `rows` is empty and `tableReady` is false.
 */
export async function getCertifications(
  schoolId: string,
  asOfISO: string,
): Promise<CertificationOverview> {
  const db = createSupabaseAdminClient()
  const { data, error } = await db
    .from('staff_certifications')
    .select(
      'id, teacher_id, kind, name, reference, issued_date, expiry_date, notes, teachers(first_name, last_name)',
    )
    .eq('school_id', schoolId)

  const tableReady = !error
  const recs = (data as unknown as Rec[] | null) ?? []

  const rows: CertificationRow[] = recs.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName:
      [r.teachers?.first_name, r.teachers?.last_name].filter(Boolean).join(' ') || 'Staff member',
    kind: isCertificationKind(r.kind) ? r.kind : 'other',
    name: r.name,
    reference: r.reference,
    issuedDate: r.issued_date,
    expiryDate: r.expiry_date,
    notes: r.notes,
    status: certificationStatus(r.expiry_date, asOfISO),
  }))

  rows.sort((a, b) => {
    if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status])
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (a.expiryDate && b.expiryDate && a.expiryDate !== b.expiryDate)
      return a.expiryDate.localeCompare(b.expiryDate)
    return a.teacherName.localeCompare(b.teacherName)
  })

  return {
    asOf: asOfISO,
    rows,
    attention: rows.filter((r) => certificationNeedsAttention(r.status)).length,
    tableReady,
  }
}
