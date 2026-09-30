import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { isPresentNow, type CheckInRow } from '@/lib/checkin/checkin'
import {
  occupancyByRoom,
  revenueByRoom,
  type OccupancyChild,
  type RevenueInvoice,
} from '@/lib/dashboard/commercial'

export const metadata: Metadata = { title: 'Commercial' }

interface RoomRow {
  id: string
  name: string
}
interface ChildRow {
  id: string
  class_id: string | null
}
interface CheckInRecord extends CheckInRow {
  student_id: string
}
interface InvoiceRow {
  student_id: string
  net_parent_cents: number
  amount_paid_cents: number
  status: string
}

export default async function CommercialPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)

  const [{ data: roomData }, { data: childData }, { data: ciData }, { data: invData }] =
    await Promise.all([
      db
        .from('classes')
        .select('id, name')
        .eq('school_id', admin.schoolId)
        .eq('is_active', true)
        .order('display_order'),
      db
        .from('students')
        .select('id, class_id')
        .eq('school_id', admin.schoolId)
        .eq('is_active', true),
      db
        .from('daily_check_ins')
        .select('student_id, checked_in_at, checked_out_at')
        .eq('school_id', admin.schoolId)
        .eq('date', todayISO),
      db
        .from('invoices')
        .select('student_id, net_parent_cents, amount_paid_cents, status')
        .eq('school_id', admin.schoolId)
        .in('status', ['issued', 'part_paid', 'paid']),
    ])

  const rooms = (roomData ?? []) as RoomRow[]
  const children = (childData ?? []) as ChildRow[]
  const presentIds = new Set(
    ((ciData ?? []) as CheckInRecord[]).filter(isPresentNow).map((r) => r.student_id),
  )
  const roomByStudent = new Map(children.map((c) => [c.id, c.class_id]))

  const occChildren: OccupancyChild[] = children.map((c) => ({
    roomId: c.class_id,
    present: presentIds.has(c.id),
  }))
  const occupancy = occupancyByRoom(rooms, occChildren)

  const revInvoices: RevenueInvoice[] = ((invData ?? []) as InvoiceRow[]).map((i) => ({
    roomId: roomByStudent.get(i.student_id) ?? null,
    netParentCents: i.net_parent_cents,
    amountPaidCents: i.amount_paid_cents,
    status: i.status,
  }))
  const revenue = revenueByRoom(rooms, revInvoices)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Commercial dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Occupancy (children present now vs enrolled) and revenue by room.
        </p>
      </div>

      {/* Occupancy */}
      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Enrolled" value={String(occupancy.totalEnrolled)} />
          <Stat label="Present now" value={String(occupancy.totalPresent)} />
          <Stat label="Utilisation" value={`${occupancy.utilisationPct}%`} accent />
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3 text-right">Enrolled</th>
                <th className="px-4 py-3 text-right">Present now</th>
                <th className="px-4 py-3">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-text-muted">
                    No rooms yet.
                  </td>
                </tr>
              )}
              {occupancy.rooms.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-right">{r.enrolled}</td>
                  <td className="px-4 py-3 text-right">{r.present}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-raised">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${r.utilisationPct}%` }}
                        />
                      </div>
                      <span className="text-text-muted">{r.utilisationPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Revenue by room */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Revenue by room</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Invoiced" value={formatCurrency(revenue.invoicedCents)} />
          <Stat label="Paid" value={formatCurrency(revenue.paidCents)} />
          <Stat
            label="Outstanding"
            value={formatCurrency(revenue.outstandingCents)}
            danger={revenue.outstandingCents > 0}
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3 text-right">Invoiced</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {revenue.rooms.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.invoicedCents)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.paidCents)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.outstandingCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {revenue.unassignedCents > 0 && (
          <p className="text-xs text-text-muted">
            {formatCurrency(revenue.unassignedCents)} invoiced to children with no current room.
          </p>
        )}
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string
  value: string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${danger ? 'text-error' : accent ? 'text-primary' : 'text-text-primary'}`}
      >
        {value}
      </p>
    </div>
  )
}
