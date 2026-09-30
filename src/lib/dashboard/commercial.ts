// Commercial dashboard aggregations (spec §7.8): occupancy by room and revenue by
// room. Pure + unit-tested. "Occupancy" here = children present now (from daily
// check-in) against enrolment, since licensed capacity isn't modelled yet.

export interface OccupancyChild {
  roomId: string | null
  present: boolean
}
export interface RoomOccupancy {
  id: string
  name: string
  enrolled: number
  present: number
  /** present / enrolled, 0–100 (0 when a room has no enrolments). */
  utilisationPct: number
}
export interface OccupancySummary {
  rooms: RoomOccupancy[]
  totalEnrolled: number
  totalPresent: number
  utilisationPct: number
}

function pct(present: number, enrolled: number): number {
  return enrolled > 0 ? Math.round((present / enrolled) * 100) : 0
}

/** Enrolled vs present-now per room, plus overall utilisation. */
export function occupancyByRoom(
  rooms: ReadonlyArray<{ id: string; name: string }>,
  children: ReadonlyArray<OccupancyChild>,
): OccupancySummary {
  const enrolledBy = new Map<string, number>()
  const presentBy = new Map<string, number>()
  for (const c of children) {
    if (!c.roomId) continue
    enrolledBy.set(c.roomId, (enrolledBy.get(c.roomId) ?? 0) + 1)
    if (c.present) presentBy.set(c.roomId, (presentBy.get(c.roomId) ?? 0) + 1)
  }
  const roomRows: RoomOccupancy[] = rooms.map((r) => {
    const enrolled = enrolledBy.get(r.id) ?? 0
    const present = presentBy.get(r.id) ?? 0
    return { id: r.id, name: r.name, enrolled, present, utilisationPct: pct(present, enrolled) }
  })
  const totalEnrolled = roomRows.reduce((s, r) => s + r.enrolled, 0)
  const totalPresent = roomRows.reduce((s, r) => s + r.present, 0)
  return {
    rooms: roomRows,
    totalEnrolled,
    totalPresent,
    utilisationPct: pct(totalPresent, totalEnrolled),
  }
}

// ─── Revenue by room ─────────────────────────────────────────────────────────

export interface RevenueInvoice {
  roomId: string | null
  netParentCents: number
  amountPaidCents: number
  status: string
}
export interface RoomRevenue {
  id: string
  name: string
  invoicedCents: number
  paidCents: number
  outstandingCents: number
}
export interface RevenueSummary {
  rooms: RoomRevenue[]
  invoicedCents: number
  paidCents: number
  outstandingCents: number
  /** Invoices whose room couldn't be resolved (child left, etc.). */
  unassignedCents: number
}

const COUNTS = new Set(['issued', 'part_paid', 'paid'])

/** Invoiced / paid / outstanding grouped by the child's room. Excludes draft/void. */
export function revenueByRoom(
  rooms: ReadonlyArray<{ id: string; name: string }>,
  invoices: ReadonlyArray<RevenueInvoice>,
): RevenueSummary {
  const byRoom = new Map<string, RoomRevenue>(
    rooms.map((r) => [
      r.id,
      { id: r.id, name: r.name, invoicedCents: 0, paidCents: 0, outstandingCents: 0 },
    ]),
  )
  let unassignedCents = 0
  for (const inv of invoices) {
    if (!COUNTS.has(inv.status)) continue
    const outstanding = Math.max(0, inv.netParentCents - inv.amountPaidCents)
    const room = inv.roomId ? byRoom.get(inv.roomId) : undefined
    if (!room) {
      unassignedCents += inv.netParentCents
      continue
    }
    room.invoicedCents += inv.netParentCents
    room.paidCents += inv.amountPaidCents
    room.outstandingCents += outstanding
  }
  const rows = [...byRoom.values()].sort((a, b) => b.invoicedCents - a.invoicedCents)
  return {
    rooms: rows,
    invoicedCents: rows.reduce((s, r) => s + r.invoicedCents, 0),
    paidCents: rows.reduce((s, r) => s + r.paidCents, 0),
    outstandingCents: rows.reduce((s, r) => s + r.outstandingCents, 0),
    unassignedCents,
  }
}
