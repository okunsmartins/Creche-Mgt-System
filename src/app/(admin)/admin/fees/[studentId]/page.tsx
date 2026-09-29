import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  ChildBillingPanel,
  type FeeScheduleView,
  type FundingView,
  type InvoiceView,
} from '@/components/fees/ChildBillingPanel'
import { ageLabel, ncsAgeEligibility } from '@/lib/age/age'

export const metadata: Metadata = { title: 'Child billing' }

// Reference NCS age window — confirm against the current Pobal circular (see FEE-03).
const NCS_AGE = { minAgeWeeks: 24, maxAgeYears: 15 }

interface PageProps {
  params: Promise<{ studentId: string }>
}

export default async function ChildBillingPage({ params }: PageProps) {
  const { studentId } = await params
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()

  const { data: student } = await db
    .from('students')
    .select('id, first_name, last_name, date_of_birth')
    .eq('id', studentId)
    .eq('school_id', admin.schoolId)
    .maybeSingle()
  if (!student) notFound()
  const s = student as {
    id: string
    first_name: string
    last_name: string
    date_of_birth: string | null
  }
  const studentName = `${s.first_name} ${s.last_name}`

  const todayISO = new Date().toISOString().slice(0, 10)
  const dob = s.date_of_birth
  const ncsAge = dob ? ncsAgeEligibility(dob, todayISO, NCS_AGE) : null

  const { data: scheduleData } = await db
    .from('fee_schedules')
    .select(
      'id, name, frequency, provider_hourly_rate_cents, flat_amount_cents, contracted_day_hours, start_date, end_date, status',
    )
    .eq('school_id', admin.schoolId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const schedule = (scheduleData as FeeScheduleView | null) ?? null

  const { data: regData } = await db
    .from('child_funding_registrations')
    .select(
      'id, scheme, status, chick_code, awarded_hourly_rate_cents, awarded_weekly_hours, higher_capitation',
    )
    .eq('school_id', admin.schoolId)
    .eq('student_id', studentId)
    .eq('status', 'ACTIVE')
  const registrations = (regData ?? []) as FundingView[]

  const { data: invData } = await db
    .from('invoices')
    .select(
      'id, invoice_number, period_start, period_end, due_date, gross_parent_cents, ncs_subsidy_cents, net_parent_cents, status',
    )
    .eq('school_id', admin.schoolId)
    .eq('student_id', studentId)
    .order('due_date')
  const invoices = (invData ?? []) as InvoiceView[]

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/fees" className="text-sm text-primary hover:underline">
          ← Fees &amp; invoices
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Billing — {studentName}</h1>
        {dob ? (
          <p className="mt-1 text-sm text-text-muted">
            DOB {dob} · {ageLabel(dob, todayISO)}
            {ncsAge && (
              <span className={ncsAge.eligible ? 'text-success' : 'text-error'}>
                {' · '}
                {ncsAge.eligible ? 'NCS age-eligible' : `Not NCS age-eligible (${ncsAge.reason})`}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-text-muted">
            No date of birth on file — add one to check NCS age eligibility.
          </p>
        )}
      </div>
      <ChildBillingPanel
        studentId={studentId}
        studentName={studentName}
        schedule={schedule}
        registrations={registrations}
        invoices={invoices}
      />
    </div>
  )
}
