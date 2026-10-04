import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { fundingEnabled } from '@/lib/funding/access'

/**
 * NCS claim-summary CSV export. Admin + funding.export + tenant feature flag;
 * school-scoped. One row per claim version with its co-payment inputs + result.
 */
export async function GET(): Promise<Response> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return new Response('No crèche associated.', { status: 400 })
  if (!admin.permissions.includes('funding.export'))
    return new Response('You do not have permission to export funding data.', { status: 403 })
  if (!(await fundingEnabled(admin.schoolId)))
    return new Response('The Funding & Hive Centre is not enabled.', { status: 403 })

  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('ncs_claim_versions')
    .select(
      'status, start_date, end_date, term_minutes, non_term_minutes, weekly_fee_cents, ncs_subsidy_cents, ecce_subsidy_cents, discount_cents, calculated_copayment_cents, manual_override_cents, calculation_version, students(first_name, last_name)',
    )
    .eq('school_id', admin.schoolId)
    .order('created_at', { ascending: false })
  const rows =
    (data as unknown as
      | {
          status: string
          start_date: string
          end_date: string | null
          term_minutes: number
          non_term_minutes: number
          weekly_fee_cents: number | null
          ncs_subsidy_cents: number
          ecce_subsidy_cents: number
          discount_cents: number
          calculated_copayment_cents: number | null
          manual_override_cents: number | null
          calculation_version: string | null
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []

  const eur = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2))
  const h = (m: number) => (m / 60).toFixed(2)
  const header = [
    'Child',
    'Status',
    'Start',
    'End',
    'Term hours',
    'Non-term hours',
    'Weekly fee (€)',
    'NCS subsidy (€)',
    'ECCE subsidy (€)',
    'Discount (€)',
    'Calculated co-payment (€)',
    'Override (€)',
    'Rules version',
  ]
  const body = rows.map((r) => [
    [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || '—',
    r.status,
    r.start_date,
    r.end_date ?? '',
    h(r.term_minutes),
    h(r.non_term_minutes),
    eur(r.weekly_fee_cents),
    eur(r.ncs_subsidy_cents),
    eur(r.ecce_subsidy_cents),
    eur(r.discount_cents),
    eur(r.calculated_copayment_cents),
    eur(r.manual_override_cents),
    r.calculation_version ?? '',
  ])
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="ncs-claims-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
