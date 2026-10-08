import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { DEFAULT_LATE_FEE_POLICY, type LateFeePolicy } from '@/lib/late-collection/fee'
import { LateFeeSettingsForm } from '@/components/late-collection/LateFeeSettingsForm'
import { RecordLateCollectionForm } from '@/components/late-collection/RecordLateCollectionForm'

export const metadata: Metadata = { title: 'Late Collection' }

interface SettingsRow {
  cutoff_time: string
  grace_minutes: number
  flat_fee_cents: number
  per_block_fee_cents: number
  block_minutes: number
  is_active: boolean
}
interface IncidentRow {
  id: string
  collected_at: string
  minutes_late: number
  fee_cents: number
  note: string | null
  parent_alerted: boolean
  students: { first_name: string; last_name: string } | null
}

function dublinTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function startOfWeekISO(todayISO: string): string {
  const t = new Date(`${todayISO}T00:00:00Z`)
  const dow = t.getUTCDay() // 0=Sun..6=Sat
  const back = (dow + 6) % 7 // days since Monday
  t.setUTCDate(t.getUTCDate() - back)
  return t.toISOString().slice(0, 10)
}

export default async function LateCollectionPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const todayISO = dublinTodayISO()
  const weekStart = startOfWeekISO(todayISO)
  const monthStart = `${todayISO.slice(0, 7)}-01`

  const [{ data: settingsData }, { data: childData }, { data: incidentData }] = await Promise.all([
    db
      .from('late_collection_settings')
      .select(
        'cutoff_time, grace_minutes, flat_fee_cents, per_block_fee_cents, block_minutes, is_active',
      )
      .eq('school_id', admin.schoolId)
      .maybeSingle(),
    db
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('last_name'),
    db
      .from('late_collections')
      .select(
        'id, collected_at, minutes_late, fee_cents, note, parent_alerted, students(first_name, last_name)',
      )
      .eq('school_id', admin.schoolId)
      .order('collected_at', { ascending: false })
      .limit(200),
  ])

  const s = settingsData as SettingsRow | null
  const policy: LateFeePolicy = s
    ? {
        cutoffTime: s.cutoff_time.slice(0, 5),
        graceMinutes: s.grace_minutes,
        flatFeeCents: s.flat_fee_cents,
        perBlockFeeCents: s.per_block_fee_cents,
        blockMinutes: s.block_minutes,
      }
    : DEFAULT_LATE_FEE_POLICY
  const feesActive = s?.is_active ?? false

  const children = (
    (childData ?? []) as { id: string; first_name: string; last_name: string }[]
  ).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))
  const incidents = (incidentData ?? []) as unknown as IncidentRow[]

  const dayOf = (iso: string) => iso.slice(0, 10)
  const inRange = (iso: string, fromISO: string) => dayOf(iso) >= fromISO && dayOf(iso) <= todayISO
  const sumFees = (pred: (i: IncidentRow) => boolean) =>
    incidents.filter(pred).reduce((n, i) => n + i.fee_cents, 0)
  const countOf = (pred: (i: IncidentRow) => boolean) => incidents.filter(pred).length

  const todayPred = (i: IncidentRow) => dayOf(i.collected_at) === todayISO
  const weekPred = (i: IncidentRow) => inRange(i.collected_at, weekStart)
  const monthPred = (i: IncidentRow) => inRange(i.collected_at, monthStart)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Late collection</h1>
        <p className="mt-1 text-sm text-text-muted">
          Set your late-collection policy, record late pick-ups against a child (the fee is worked
          out automatically), and alert the parent.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">Today</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{countOf(todayPred)}</p>
          <p className="text-xs text-text-muted">{formatCurrency(sumFees(todayPred))} in fees</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">This week</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{countOf(weekPred)}</p>
          <p className="text-xs text-text-muted">{formatCurrency(sumFees(weekPred))} in fees</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-text-muted">This month</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{countOf(monthPred)}</p>
          <p className="text-xs text-text-muted">{formatCurrency(sumFees(monthPred))} in fees</p>
        </div>
      </div>

      {/* Record + policy */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Record a late collection</h2>
          {children.length === 0 ? (
            <p className="text-sm text-text-muted">Add children first.</p>
          ) : (
            <RecordLateCollectionForm
              childOptions={children}
              policy={policy}
              feesActive={feesActive}
              todayISO={todayISO}
            />
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-1 text-lg font-semibold text-text-primary">Late-collection policy</h2>
          <p className="mb-4 text-xs text-text-muted">
            Applies across this crèche. {feesActive ? '' : 'Late fees are currently inactive.'}
          </p>
          <LateFeeSettingsForm
            initial={{
              cutoffTime: policy.cutoffTime,
              graceMinutes: policy.graceMinutes,
              flatFeeEuros: (policy.flatFeeCents / 100).toFixed(2),
              perBlockFeeEuros: (policy.perBlockFeeCents / 100).toFixed(2),
              blockMinutes: policy.blockMinutes,
              isActive: feesActive,
            }}
          />
        </section>
      </div>

      {/* Recent incidents */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Recent late collections
        </h2>
        {incidents.length === 0 ? (
          <p className="text-sm text-text-muted">No late collections recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="px-4 py-3">Child</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3 text-right">Late</th>
                  <th className="px-4 py-3 text-right">Fee</th>
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => {
                  const name = i.students ? `${i.students.first_name} ${i.students.last_name}` : '—'
                  const when = i.collected_at.replace('T', ' ').slice(0, 16)
                  return (
                    <tr key={i.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="px-4 py-3">{when}</td>
                      <td className="px-4 py-3 text-right">{i.minutes_late} min</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(i.fee_cents)}
                      </td>
                      <td className="px-4 py-3">
                        {i.parent_alerted ? (
                          <Badge variant="success">Alerted</Badge>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">{i.note ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
