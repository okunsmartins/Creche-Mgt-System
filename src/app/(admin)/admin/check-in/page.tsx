import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { checkInState, type CheckInRow } from '@/lib/checkin/checkin'
import { CheckInBoard, type CheckInRoom } from '@/components/checkin/CheckInBoard'
import type { StudentCareFields } from '@/lib/students/schemas'

export const metadata: Metadata = { title: 'Daily check-in' }

interface RoomRow {
  id: string
  name: string
}
interface ChildRow {
  id: string
  first_name: string
  last_name: string
  class_id: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  allergies: string | null
  dietary_needs: string | null
  medical_conditions: string | null
  medication_consent: boolean
  medication_notes: string | null
  session: StudentCareFields['session']
}
interface CheckInRecord extends CheckInRow {
  student_id: string
}

export default async function CheckInPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const todayISO = new Date().toISOString().slice(0, 10)
  const dateLabel = new Date().toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const [{ data: roomData }, { data: childData }, { data: ciData }] = await Promise.all([
    db
      .from('classes')
      .select('id, name')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('display_order'),
    db
      .from('students')
      .select(
        'id, first_name, last_name, class_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, allergies, dietary_needs, medical_conditions, medication_consent, medication_notes, session',
      )
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('last_name'),
    db
      .from('daily_check_ins')
      .select('student_id, checked_in_at, checked_out_at')
      .eq('school_id', admin.schoolId)
      .eq('date', todayISO),
  ])

  const rooms = (roomData ?? []) as RoomRow[]
  const children = (childData ?? []) as ChildRow[]
  const byStudent = new Map<string, CheckInRecord>()
  for (const r of (ciData ?? []) as CheckInRecord[]) byStudent.set(r.student_id, r)

  const roomsWithChildren: CheckInRoom[] = rooms
    .map((room) => ({
      id: room.id,
      name: room.name,
      children: children
        .filter((c) => c.class_id === room.id)
        .map((c) => {
          const rec = byStudent.get(c.id)
          return {
            id: c.id,
            name: `${c.first_name} ${c.last_name}`,
            state: checkInState(rec),
            checkedInAt: rec?.checked_in_at ?? null,
            checkedOutAt: rec?.checked_out_at ?? null,
            care: {
              emergencyContactName: c.emergency_contact_name,
              emergencyContactPhone: c.emergency_contact_phone,
              emergencyContactRelationship: c.emergency_contact_relationship,
              allergies: c.allergies,
              dietaryNeeds: c.dietary_needs,
              medicalConditions: c.medical_conditions,
              medicationConsent: c.medication_consent,
              medicationNotes: c.medication_notes,
              session: c.session,
            },
          }
        }),
    }))
    .filter((room) => room.children.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Daily check-in</h1>
        <p className="mt-1 text-sm text-text-muted">
          Mark arrivals and departures. Present counts feed live room ratios.
        </p>
      </div>
      <CheckInBoard rooms={roomsWithChildren} dateLabel={dateLabel} />
    </div>
  )
}
