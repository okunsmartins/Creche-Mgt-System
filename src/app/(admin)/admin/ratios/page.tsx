import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ageInMonthsAt } from '@/lib/age/age'
import { roomStaffingRequirement } from '@/lib/ratios/ratio'
import { isPresentNow, type CheckInRow } from '@/lib/checkin/checkin'
import { RatioBoard, type RoomRatio } from '@/components/ratios/RatioBoard'

export const metadata: Metadata = { title: 'Ratios' }

interface RoomRow {
  id: string
  name: string
}
interface ChildRow {
  id: string
  class_id: string | null
  date_of_birth: string | null
}
interface CheckInRecord extends CheckInRow {
  student_id: string
}

export default async function RatiosPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)

  const { data: roomData } = await db
    .from('classes')
    .select('id, name')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('display_order')
  const rooms = (roomData ?? []) as RoomRow[]

  const { data: childData } = await db
    .from('students')
    .select('id, class_id, date_of_birth')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
  const children = (childData ?? []) as ChildRow[]

  // Today's check-ins (defensive: empty if the table isn't there yet — migration 073).
  const { data: ciData } = await db
    .from('daily_check_ins')
    .select('student_id, checked_in_at, checked_out_at')
    .eq('school_id', admin.schoolId)
    .eq('date', todayISO)
  const presentSet = new Set(
    ((ciData ?? []) as CheckInRecord[]).filter(isPresentNow).map((r) => r.student_id),
  )

  // Ratio basis = children PRESENT NOW (from daily check-in); enrolled shown for context.
  const presentAgesByRoom = new Map<string, (number | null)[]>()
  const enrolledByRoom = new Map<string, number>()
  for (const c of children) {
    if (!c.class_id) continue
    enrolledByRoom.set(c.class_id, (enrolledByRoom.get(c.class_id) ?? 0) + 1)
    if (!presentSet.has(c.id)) continue
    const arr = presentAgesByRoom.get(c.class_id) ?? []
    arr.push(c.date_of_birth ? ageInMonthsAt(c.date_of_birth, todayISO) : null)
    presentAgesByRoom.set(c.class_id, arr)
  }

  const roomRatios: RoomRatio[] = rooms.map((r) => {
    const req = roomStaffingRequirement(presentAgesByRoom.get(r.id) ?? [])
    return {
      id: r.id,
      name: r.name,
      childrenCount: req.totalPlaced + req.unknownAge,
      enrolledCount: enrolledByRoom.get(r.id) ?? 0,
      unknownAge: req.unknownAge,
      requiredStaff: req.requiredStaff,
      byBand: req.byBand.map((b) => ({
        label: b.band.label,
        childrenPerAdult: b.band.childrenPerAdult,
        children: b.children,
        required: b.required,
      })),
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Room ratios</h1>
        <p className="mt-1 text-sm text-text-muted">
          Live staffing based on children <strong>present now</strong> (from daily check-in) and
          their ages. Enter staff on duty to check compliance. Reference Irish ratios —{' '}
          <strong>confirm against current Tusla regulations</strong>.
        </p>
      </div>
      <RatioBoard rooms={roomRatios} />
    </div>
  )
}
