import type { BarDatum } from '@/components/charts/BarChart'
import type { DonutDatum } from '@/components/charts/DonutChart'

const STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  partially_paid: 'Partially paid',
  pending_payment: 'Pending',
  payment_failed: 'Failed',
  draft: 'Draft',
  cancelled: 'Cancelled',
  expired: 'Expired',
  partially_refunded: 'Part. refunded',
  fully_refunded: 'Refunded',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

/** Donut: count orders by status, most common first. */
export function ordersByStatus(orders: { status: string }[]): DonutDatum[] {
  const counts = new Map<string, number>()
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({ label: statusLabel(status), value }))
}

/** Bar: sum of `amount_paid_cents` per month over the last `months` months. */
export function paidByMonth(
  orders: { amount_paid_cents: number; created_at: string }[],
  months = 6,
): BarDatum[] {
  const now = new Date()
  const buckets = Array.from({ length: months }, (_, n) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - n), 1)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthShort(d), value: 0 }
  })
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  for (const o of orders) {
    const d = new Date(o.created_at)
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (i !== undefined) buckets[i]!.value += o.amount_paid_cents
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}

/** Bar: sum of `total_cents` per day over the last `days` days (ending today). */
export function collectedByDay(
  orders: { total_cents: number; created_at: string }[],
  days = 7,
): BarDatum[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = Array.from({ length: days }, (_, n) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (days - 1 - n))
    return { key: localDateKey(d), label: weekdayShort(d), value: 0 }
  })
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  for (const o of orders) {
    const i = index.get(localDateKey(new Date(o.created_at)))
    if (i !== undefined) buckets[i]!.value += o.total_cents
  }
  return buckets.map(({ label, value }) => ({ label, value }))
}

/** Local (not UTC) YYYY-MM-DD key, so "today" buckets match the viewer's day. */
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthShort(d: Date): string {
  return d.toLocaleString('en-IE', { month: 'short' })
}

function weekdayShort(d: Date): string {
  return d.toLocaleDateString('en-IE', { weekday: 'short' })
}
