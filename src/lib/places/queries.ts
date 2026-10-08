import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { availablePlaces, isUpcomingLeaver } from './places'

export interface RoomPlaces {
  id: string
  name: string
  capacity: number | null
  enrolled: number
  available: number | null
}
export interface UpcomingLeaver {
  studentId: string
  name: string
  roomName: string
  leavingDate: string
}
export interface PlacesOverview {
  rooms: RoomPlaces[]
  leavers: UpcomingLeaver[]
  totalCapacity: number
  totalEnrolled: number
  totalAvailable: number
}

type RoomRow = { id: string; name: string; capacity: number | null }
type StudentRow = {
  id: string
  class_id: string | null
  first_name: string | null
  last_name: string | null
  leaving_date: string | null
}

/**
 * Places overview: per-room capacity vs enrolment (available = vacancies) and upcoming
 * leavers (children with a leaving date within 90 days → upcoming vacancies). School-scoped;
 * tolerant of the capacity/leaving_date columns being absent pre-migration.
 */
export async function getPlacesOverview(
  schoolId: string,
  todayISO: string,
): Promise<PlacesOverview> {
  const db = createSupabaseAdminClient()
  const [{ data: roomData }, { data: childData }] = await Promise.all([
    db
      .from('classes')
      .select('id, name, capacity')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('display_order'),
    db
      .from('students')
      .select('id, class_id, first_name, last_name, leaving_date')
      .eq('school_id', schoolId)
      .eq('is_active', true),
  ])

  const rooms = (roomData as RoomRow[] | null) ?? []
  const children = (childData as StudentRow[] | null) ?? []

  const enrolledByRoom = new Map<string, number>()
  for (const c of children)
    if (c.class_id) enrolledByRoom.set(c.class_id, (enrolledByRoom.get(c.class_id) ?? 0) + 1)

  const roomName = new Map(rooms.map((r) => [r.id, r.name]))

  const roomPlaces: RoomPlaces[] = rooms.map((r) => {
    const enrolled = enrolledByRoom.get(r.id) ?? 0
    return {
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      enrolled,
      available: availablePlaces(r.capacity, enrolled),
    }
  })

  const leavers: UpcomingLeaver[] = children
    .filter((c) => isUpcomingLeaver(c.leaving_date, todayISO))
    .map((c) => ({
      studentId: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Child',
      roomName: c.class_id ? (roomName.get(c.class_id) ?? 'Unassigned') : 'Unassigned',
      leavingDate: c.leaving_date!,
    }))
    .sort((a, b) => a.leavingDate.localeCompare(b.leavingDate))

  const totalCapacity = roomPlaces.reduce((n, r) => n + (r.capacity ?? 0), 0)
  const totalEnrolled = roomPlaces.reduce((n, r) => n + r.enrolled, 0)
  const totalAvailable = roomPlaces.reduce((n, r) => n + (r.available ?? 0), 0)

  return { rooms: roomPlaces, leavers, totalCapacity, totalEnrolled, totalAvailable }
}
