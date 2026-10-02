'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import {
  createCollectionMethodAction,
  deleteCollectionMethodAction,
  createCollectionRunAction,
  deleteCollectionRunAction,
} from '@/lib/collection/actions'
import {
  CHARGE_BASES,
  CHARGE_BASIS_LABELS,
  CHARGE_BASIS_UNIT,
  WEEKDAY_LABELS,
  formatDays,
  assessRunStaffing,
  type ChargeBasis,
} from '@/lib/collection/collection'

export interface MethodRow {
  id: string
  label: string
  has_transport: boolean
  is_active: boolean
}
export interface RunRow {
  id: string
  name: string
  originSchoolName: string
  methodLabel: string | null
  days: number[]
  pickupTime: string | null
  capacity: number
  childrenPerChaperone: number
  chargeBasis: string
  priceCents: number
  staffIds: string[]
}
export interface StaffOption {
  id: string
  first_name: string | null
  last_name: string | null
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export function CollectionPanel({
  methods,
  runs,
  staff,
}: {
  methods: MethodRow[]
  runs: RunRow[]
  staff: StaffOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [methodOpen, setMethodOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)

  const staffName = (s: StaffOption) =>
    [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Staff member'

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        after?.()
        router.refresh()
      }
    })
  }

  function submitMethod(form: HTMLFormElement) {
    const fd = new FormData(form)
    run(
      () =>
        createCollectionMethodAction({
          label: (fd.get('label') as string) ?? '',
          hasTransport: fd.get('hasTransport') === 'on',
        }),
      () => {
        form.reset()
        setMethodOpen(false)
      },
    )
  }

  function submitRun(form: HTMLFormElement) {
    const fd = new FormData(form)
    const days = WEEKDAYS.filter((d) => fd.get(`day_${d}`) === 'on')
    const euros = parseFloat((fd.get('price') as string) || '0')
    const teacherIds = staff.map((s) => s.id).filter((id) => fd.get(`staff_${id}`) === 'on')
    run(
      () =>
        createCollectionRunAction({
          name: (fd.get('name') as string) ?? '',
          originSchoolName: (fd.get('originSchoolName') as string) ?? '',
          collectionMethodId: (fd.get('collectionMethodId') as string) || null,
          days,
          pickupTime: (fd.get('pickupTime') as string) || null,
          capacity: parseInt((fd.get('capacity') as string) || '0', 10),
          chargeBasis: (fd.get('chargeBasis') as string) ?? 'per_day',
          priceCents: Number.isFinite(euros) ? Math.round(euros * 100) : -1,
          teacherIds,
        }),
      () => {
        form.reset()
        setRunOpen(false)
      },
    )
  }

  return (
    <div className="space-y-8">
      {error && <Alert variant="error">{error}</Alert>}

      {/* ── Methods ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Collection methods</h2>
          <Button type="button" variant="secondary" onClick={() => setMethodOpen((v) => !v)}>
            {methodOpen ? 'Cancel' : 'Add method'}
          </Button>
        </div>

        {methodOpen && (
          <form
            className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault()
              submitMethod(e.currentTarget)
            }}
          >
            <Input
              label="Method name"
              name="label"
              placeholder="e.g. Minibus, Walking bus"
              required
            />
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="hasTransport" className="h-4 w-4" />
              <span>Involves transport (vehicle)</span>
            </label>
            <Button type="submit" disabled={isPending}>
              Save method
            </Button>
          </form>
        )}

        {methods.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-text-muted">
            No methods yet. Add one (e.g. Minibus, Walking bus, Gate collection) to use when
            creating runs.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              >
                {m.label}
                {m.has_transport && <Badge variant="default">transport</Badge>}
                <button
                  type="button"
                  onClick={() => run(() => deleteCollectionMethodAction(m.id))}
                  disabled={isPending}
                  className="text-text-muted hover:text-error"
                  aria-label={`Delete ${m.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Runs ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">School runs</h2>
          <Button type="button" onClick={() => setRunOpen((v) => !v)}>
            {runOpen ? 'Cancel' : 'Add run'}
          </Button>
        </div>

        {runOpen && (
          <form
            className="grid gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitRun(e.currentTarget)
            }}
          >
            <Input label="Run name" name="name" placeholder="e.g. After-school run" required />
            <Input
              label="School collected from"
              name="originSchoolName"
              placeholder="Primary school name"
              required
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Method</span>
              <select name="collectionMethodId" className="input-base" defaultValue="">
                <option value="">— none —</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Charge basis</span>
              <select name="chargeBasis" className="input-base" defaultValue="per_day">
                {CHARGE_BASES.map((b) => (
                  <option key={b} value={b}>
                    {CHARGE_BASIS_LABELS[b]}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Price (€)" name="price" type="number" step="0.01" min="0" required />
            <Input
              label="Capacity"
              name="capacity"
              type="number"
              min="1"
              defaultValue="8"
              required
            />
            <Input label="Pickup time" name="pickupTime" type="time" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-primary">Days</span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <label key={d} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      name={`day_${d}`}
                      defaultChecked={d <= 5}
                      className="h-3.5 w-3.5"
                    />
                    {WEEKDAY_LABELS[d]}
                  </label>
                ))}
              </div>
            </div>
            {staff.length > 0 && (
              <div className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-text-primary">Assign chaperones (staff)</span>
                <div className="flex flex-wrap gap-3">
                  {staff.map((s) => (
                    <label key={s.id} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name={`staff_${s.id}`} className="h-3.5 w-3.5" />
                      {staffName(s)}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isPending}>
                Save run
              </Button>
            </div>
          </form>
        )}

        {runs.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
            No runs yet. Add one to offer collection from a primary school.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Capacity / staff</th>
                  <th className="px-4 py-3">Charge</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  // Staffing hint: can the assigned chaperones cover a full run?
                  const a = assessRunStaffing(r.capacity, r.staffIds.length, r.childrenPerChaperone)
                  return (
                    <tr key={r.id} className="border-b border-border/50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-text-muted">
                          from {r.originSchoolName}
                          {r.methodLabel ? ` · ${r.methodLabel}` : ''}
                          {r.pickupTime ? ` · ${r.pickupTime}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatDays(r.days)}</td>
                      <td className="px-4 py-3">
                        {r.staffIds.length} / {a.requiredChaperones} needed · cap {r.capacity}
                        {!a.ratioMet && (
                          <Badge variant="warning">
                            +{a.requiredChaperones - r.staffIds.length} chaperone(s)
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(r.priceCents)} /{' '}
                        {CHARGE_BASIS_UNIT[r.chargeBasis as ChargeBasis] ?? r.chargeBasis}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => run(() => deleteCollectionRunAction(r.id))}
                          disabled={isPending}
                          className="text-xs text-text-muted hover:text-error"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
