import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ageInMonthsAt } from '@/lib/age/age'
import { roomStaffingRequirement } from '@/lib/ratios/ratio'
import { RatioBoard, type RoomRatio } from '@/components/ratios/RatioBoard'

export const metadata: Metadata = { title: 'Ratios' }

interface RoomRow {
  id: string
  name: string
}
interface ChildRow {
  class_id: string
  date_of_birth: string | null
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
    .select('class_id, date_of_birth')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
  const children = (childData ?? []) as ChildRow[]

  const agesByRoom = new Map<string, (number | null)[]>()
  for (const c of children) {
    if (!c.class_id) continue
    const arr = agesByRoom.get(c.class_id) ?? []
    arr.push(c.date_of_birth ? ageInMonthsAt(c.date_of_birth, todayISO) : null)
    agesByRoom.set(c.class_id, arr)
  }

  const roomRatios: RoomRatio[] = rooms.map((r) => {
    const req = roomStaffingRequirement(agesByRoom.get(r.id) ?? [])
    return {
      id: r.id,
      name: r.name,
      childrenCount: req.totalPlaced + req.unknownAge,
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
          Minimum staffing per room from each child’s age. Enter staff on duty to check today’s
          compliance. Reference Irish ratios —{' '}
          <strong>confirm against current Tusla regulations</strong>.
        </p>
      </div>
      <RatioBoard rooms={roomRatios} />
    </div>
  )
}
