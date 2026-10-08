'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import {
  createFeeScheduleAction,
  updateFeeScheduleAction,
  upsertFundingRegistrationAction,
  updateFundingRegistrationAction,
  updateInvoiceDueDateAction,
  generateInvoicesForScheduleAction,
  issueInvoicesForScheduleAction,
  voidInvoicesForScheduleAction,
} from '@/lib/fees/actions'
import type { FeeFrequency } from '@/lib/fees/schedule'

export interface FeeScheduleView {
  id: string
  name: string
  frequency: FeeFrequency
  provider_hourly_rate_cents: number | null
  flat_amount_cents: number | null
  contracted_day_hours: number[] | null
  start_date: string
  end_date: string
  status: string
}

export interface FundingView {
  id: string
  scheme: 'ECCE' | 'NCS'
  status: string
  chick_code: string | null
  awarded_hourly_rate_cents: number | null
  awarded_weekly_hours: number | null
  higher_capitation: boolean
}

export interface InvoiceView {
  id: string
  invoice_number: string
  period_start: string
  period_end: string
  due_date: string
  gross_parent_cents: number
  ncs_subsidy_cents: number
  net_parent_cents: number
  status: string
}

interface Props {
  studentId: string
  studentName: string
  schedule: FeeScheduleView | null
  registrations: FundingView[]
  invoices: InvoiceView[]
}

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
]

function eurosToCents(v: string): number | null {
  const n = Number.parseFloat(v)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

function centsToEuros(c: number | null | undefined): string {
  return c == null ? '' : (c / 100).toFixed(2)
}

export function ChildBillingPanel({
  studentId,
  studentName,
  schedule,
  registrations,
  invoices,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // ── Fee-schedule form state (used for both create and edit) ──
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [mode, setMode] = useState<'hourly' | 'flat'>('hourly')
  const [name, setName] = useState('Standard fee')
  const [frequency, setFrequency] = useState<FeeFrequency>('weekly')
  const [hourlyRate, setHourlyRate] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [daysPerWeek, setDaysPerWeek] = useState('5')
  const [flatAmount, setFlatAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const scheduleFormOpen = !schedule || editingSchedule

  function beginEditSchedule() {
    if (!schedule) return
    setError(null)
    setNotice(null)
    setMode(schedule.flat_amount_cents != null ? 'flat' : 'hourly')
    setName(schedule.name)
    setFrequency(schedule.frequency)
    setHourlyRate(centsToEuros(schedule.provider_hourly_rate_cents))
    setHoursPerDay(String(schedule.contracted_day_hours?.[0] ?? 8))
    setDaysPerWeek(String(schedule.contracted_day_hours?.length ?? 5))
    setFlatAmount(centsToEuros(schedule.flat_amount_cents))
    setStartDate(schedule.start_date)
    setEndDate(schedule.end_date)
    setEditingSchedule(true)
  }

  function saveSchedule() {
    setError(null)
    setNotice(null)
    if (!startDate || !endDate) {
      setError('Choose a start and end date.')
      return
    }
    const days = Math.max(0, Math.min(7, Number.parseInt(daysPerWeek, 10) || 0))
    const hrs = Math.max(0, Number.parseFloat(hoursPerDay) || 0)
    const dayHours = Array.from({ length: days }, () => hrs)

    const input = {
      studentId,
      name,
      frequency,
      startDate,
      endDate,
      ...(mode === 'hourly'
        ? { providerHourlyRateCents: eurosToCents(hourlyRate), contractedDayHours: dayHours }
        : { flatAmountCents: eurosToCents(flatAmount) }),
    }
    startTransition(async () => {
      const res =
        schedule && editingSchedule
          ? await updateFeeScheduleAction(schedule.id, input)
          : await createFeeScheduleAction(input)
      if (!res.ok) setError(res.error)
      else {
        setNotice(schedule && editingSchedule ? 'Fee schedule updated.' : 'Fee schedule saved.')
        setEditingSchedule(false)
        router.refresh()
      }
    })
  }

  // ── Funding ──
  const [editingEcce, setEditingEcce] = useState(false)
  const [editingNcs, setEditingNcs] = useState(false)

  function saveFunding(scheme: 'ECCE' | 'NCS', form: HTMLFormElement, existingId: string | null) {
    setError(null)
    setNotice(null)
    const fd = new FormData(form)
    const base = { studentId, scheme, status: 'ACTIVE' as const }
    const input =
      scheme === 'NCS'
        ? {
            ...base,
            chickCode: (fd.get('chick') as string) || null,
            ncsSubsidyType: ((fd.get('ncsType') as string) || 'UNIVERSAL') as
              | 'UNIVERSAL'
              | 'INCOME_ASSESSED',
            awardedHourlyRateCents: eurosToCents((fd.get('rate') as string) || ''),
            awardedWeeklyHours: Number.parseFloat((fd.get('hours') as string) || '0') || null,
            ppsNumber: (fd.get('ppsn') as string) || null,
          }
        : { ...base, higherCapitation: fd.get('higher') === 'on' }
    startTransition(async () => {
      const res = existingId
        ? await updateFundingRegistrationAction(existingId, input)
        : await upsertFundingRegistrationAction(input)
      if (!res.ok) setError(res.error)
      else {
        setNotice(`${scheme} registration ${existingId ? 'updated' : 'saved'}.`)
        setEditingEcce(false)
        setEditingNcs(false)
        router.refresh()
      }
    })
  }

  // ── Invoice due-date editing ──
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [dueDraft, setDueDraft] = useState('')

  function saveDueDate(invoiceId: string) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await updateInvoiceDueDateAction(invoiceId, dueDraft)
      if (!res.ok) setError(res.error)
      else {
        setNotice('Due date updated.')
        setEditingInvoiceId(null)
        router.refresh()
      }
    })
  }

  function generate() {
    if (!schedule) return
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await generateInvoicesForScheduleAction(schedule.id)
      if (!res.ok) setError(res.error)
      else {
        setNotice(
          `Generated ${res.created} invoice(s), total due ${formatCurrency(res.totalNetCents)}.`,
        )
        router.refresh()
      }
    })
  }

  function issueAll() {
    if (!schedule) return
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await issueInvoicesForScheduleAction(schedule.id)
      if (!res.ok) setError(res.error)
      else {
        setNotice(`Issued ${res.issued} invoice(s).`)
        router.refresh()
      }
    })
  }

  function voidAll() {
    if (!schedule) return
    if (!window.confirm('Void all invoices for this schedule? You can regenerate afterwards.'))
      return
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const res = await voidInvoicesForScheduleAction(schedule.id)
      if (!res.ok) setError(res.error)
      else {
        setNotice(`Voided ${res.voided} invoice(s). You can regenerate now.`)
        router.refresh()
      }
    })
  }

  const ecce = registrations.find((r) => r.scheme === 'ECCE')
  const ncs = registrations.find((r) => r.scheme === 'NCS')

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* ─── Fee schedule ─── */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-text-primary">Fee schedule</h2>
          {schedule && !editingSchedule && (
            <Button type="button" variant="secondary" onClick={beginEditSchedule}>
              Edit
            </Button>
          )}
        </div>

        {schedule && !editingSchedule && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="success">{schedule.status}</Badge>
            <span className="font-medium">{schedule.name}</span>
            <span className="text-text-muted">
              {schedule.frequency} ·{' '}
              {schedule.flat_amount_cents != null
                ? `${formatCurrency(schedule.flat_amount_cents)}/period`
                : `${formatCurrency(schedule.provider_hourly_rate_cents ?? 0)}/hr`}{' '}
              · {schedule.start_date} → {schedule.end_date}
            </span>
          </div>
        )}

        {!schedule && !editingSchedule && (
          <p className="mt-1 text-sm text-text-muted">
            No fee schedule yet for {studentName}. Add one below.
          </p>
        )}

        {scheduleFormOpen && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Select
              label="Frequency"
              options={FREQ_OPTIONS}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as FeeFrequency)}
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button
                type="button"
                variant={mode === 'hourly' ? 'primary' : 'secondary'}
                onClick={() => setMode('hourly')}
              >
                Hourly rate
              </Button>
              <Button
                type="button"
                variant={mode === 'flat' ? 'primary' : 'secondary'}
                onClick={() => setMode('flat')}
              >
                Flat fee
              </Button>
            </div>
            {mode === 'hourly' ? (
              <>
                <Input
                  label="Provider rate (€/hour)"
                  type="number"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Hours/day"
                    type="number"
                    step="0.5"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(e.target.value)}
                  />
                  <Input
                    label="Days/week"
                    type="number"
                    value={daysPerWeek}
                    onChange={(e) => setDaysPerWeek(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <Input
                label="Flat amount (€/period)"
                type="number"
                step="0.01"
                value={flatAmount}
                onChange={(e) => setFlatAmount(e.target.value)}
                required
              />
            )}
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            <div className="flex items-center gap-2 sm:col-span-2">
              <Button type="button" onClick={saveSchedule} disabled={isPending}>
                {schedule && editingSchedule ? 'Save changes' : 'Save fee schedule'}
              </Button>
              {editingSchedule && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingSchedule(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              )}
            </div>
            {schedule && editingSchedule && invoices.length > 0 && (
              <p className="text-xs text-text-muted sm:col-span-2">
                Note: already-generated invoices keep their amounts. To apply the new schedule to
                outstanding periods, void the invoices below and regenerate.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ─── Funding (ECCE / NCS) ─── */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-text-primary">Funding (ECCE / NCS)</h2>
        <p className="mt-1 text-sm text-text-muted">
          Enter the authoritative award data from the child’s CHICK / ECCE registration. These feed
          the subvention netting on generated invoices.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {/* ECCE */}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              saveFunding('ECCE', e.currentTarget, editingEcce && ecce ? ecce.id : null)
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">ECCE</h3>
                {ecce && <Badge variant="success">{ecce.status}</Badge>}
              </div>
              {ecce && !editingEcce && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setError(null)
                    setNotice(null)
                    setEditingEcce(true)
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
            {ecce && !editingEcce ? (
              <p className="text-sm text-text-muted">
                Registered{ecce.higher_capitation ? ' · higher capitation' : ''}.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="higher"
                    defaultChecked={editingEcce ? ecce?.higher_capitation : false}
                  />{' '}
                  Higher (graduate-led) capitation
                </label>
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary" disabled={isPending}>
                    {editingEcce ? 'Save changes' : 'Add ECCE registration'}
                  </Button>
                  {editingEcce && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingEcce(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </>
            )}
          </form>

          {/* NCS */}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              saveFunding('NCS', e.currentTarget, editingNcs && ncs ? ncs.id : null)
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">NCS</h3>
                {ncs && <Badge variant="success">{ncs.status}</Badge>}
              </div>
              {ncs && !editingNcs && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setError(null)
                    setNotice(null)
                    setEditingNcs(true)
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
            {ncs && !editingNcs ? (
              <p className="text-sm text-text-muted">
                {ncs.chick_code ? `CHICK ${ncs.chick_code} · ` : ''}
                {formatCurrency(ncs.awarded_hourly_rate_cents ?? 0)}/hr ·{' '}
                {ncs.awarded_weekly_hours ?? 0} hrs/wk
              </p>
            ) : (
              <>
                <Input label="CHICK code" name="chick" defaultValue={ncs?.chick_code ?? ''} />
                <Select
                  label="Subsidy type"
                  name="ncsType"
                  options={[
                    { value: 'UNIVERSAL', label: 'Universal' },
                    { value: 'INCOME_ASSESSED', label: 'Income assessed' },
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Awarded rate (€/hr)"
                    name="rate"
                    type="number"
                    step="0.01"
                    defaultValue={centsToEuros(ncs?.awarded_hourly_rate_cents)}
                  />
                  <Input
                    label="Band hours/wk"
                    name="hours"
                    type="number"
                    step="0.5"
                    defaultValue={ncs?.awarded_weekly_hours ?? ''}
                  />
                </div>
                <Input
                  label="PPSN (stored encrypted)"
                  name="ppsn"
                  hint={
                    editingNcs
                      ? 'Leave blank to keep the existing PPSN.'
                      : 'Special-category data — encrypted at rest.'
                  }
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary" disabled={isPending}>
                    {editingNcs ? 'Save changes' : 'Add NCS registration'}
                  </Button>
                  {editingNcs && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingNcs(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </>
            )}
          </form>
        </div>
      </section>

      {/* ─── Invoices ─── */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text-primary">Invoices</h2>
          <div className="flex gap-2">
            {schedule && invoices.length === 0 && (
              <Button type="button" onClick={generate} disabled={isPending}>
                Generate invoices
              </Button>
            )}
            {schedule && invoices.some((i) => i.status === 'draft') && (
              <Button type="button" onClick={issueAll} disabled={isPending}>
                Issue all
              </Button>
            )}
            {schedule && invoices.length > 0 && (
              <Button type="button" variant="secondary" onClick={voidAll} disabled={isPending}>
                Void all
              </Button>
            )}
          </div>
        </div>
        {invoices.length === 0 ? (
          <p className="mt-1 text-sm text-text-muted">
            {schedule ? 'No invoices yet — click Generate.' : 'Add a fee schedule first.'}
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-text-muted">
              Issued invoice amounts are locked for audit — to change a figure, void and regenerate.
              You can still reschedule a due date here.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-muted">
                    <th className="py-2 pr-3">Invoice</th>
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Due</th>
                    <th className="py-2 pr-3 text-right">Gross</th>
                    <th className="py-2 pr-3 text-right">Subsidy</th>
                    <th className="py-2 pr-3 text-right">Net</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const editing = editingInvoiceId === inv.id
                    return (
                      <tr key={inv.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-mono text-xs">{inv.invoice_number}</td>
                        <td className="py-2 pr-3">
                          {inv.period_start} → {inv.period_end}
                        </td>
                        <td className="py-2 pr-3">
                          {editing ? (
                            <input
                              type="date"
                              value={dueDraft}
                              onChange={(e) => setDueDraft(e.target.value)}
                              className="rounded-md border border-border bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          ) : (
                            inv.due_date
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {formatCurrency(inv.gross_parent_cents)}
                        </td>
                        <td className="py-2 pr-3 text-right text-success">
                          −{formatCurrency(inv.ncs_subsidy_cents)}
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold">
                          {formatCurrency(inv.net_parent_cents)}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={inv.status === 'draft' ? 'default' : 'success'}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          {inv.status === 'void' ? null : editing ? (
                            <span className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveDueDate(inv.id)}
                                disabled={isPending}
                                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInvoiceId(null)}
                                className="text-xs text-text-muted hover:underline"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setError(null)
                                setNotice(null)
                                setDueDraft(inv.due_date)
                                setEditingInvoiceId(inv.id)
                              }}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Edit due
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
