import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses } from '@/lib/teachers/classes'
import { AvailabilityForm } from '@/components/meetings/AvailabilityForm'
import { DeleteSlotButton } from '@/components/meetings/SlotButtons'
import { formatSlotTime, schoolNow } from '@/lib/meetings/slots'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Meetings | Teacher' }

type SlotRow = {
  id: string
  slot_date: string
  start_time: string
  end_time: string
  booked_parent_id: string | null
  profiles: { first_name: string | null; last_name: string | null } | null
  students: { first_name: string; last_name: string } | null
  classes: { name: string } | null
}

export default async function TeacherMeetingsPage() {
  const teacher = await requireTeacher()
  const adminClient = createSupabaseAdminClient()

  const teacherClasses = await resolveTeacherClasses(adminClient, teacher.email)
  const teacherId = teacherClasses?.teacherId
  const classes = teacherClasses?.classes ?? []

  const { today } = schoolNow()
  const { data } = teacherId
    ? await adminClient
        .from('meeting_slots')
        .select(
          'id, slot_date, start_time, end_time, booked_parent_id, profiles!booked_parent_id(first_name, last_name), students!booked_student_id(first_name, last_name), classes(name)',
        )
        .eq('teacher_id', teacherId)
        .gte('slot_date', today)
        .order('slot_date')
        .order('start_time')
    : { data: [] }
  const slots = (data as SlotRow[] | null) ?? []

  // Group by date for display.
  const byDate = new Map<string, SlotRow[]>()
  for (const s of slots) {
    const list = byDate.get(s.slot_date) ?? []
    list.push(s)
    byDate.set(s.slot_date, list)
  }
  const bookedCount = slots.filter((s) => s.booked_parent_id).length

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Parent–teacher meetings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Publish times you are available; parents of your class book a slot.
          {bookedCount > 0
            ? ` ${bookedCount} upcoming meeting${bookedCount === 1 ? '' : 's'} booked.`
            : ''}
        </p>
      </div>

      {teacherId ? (
        <AvailabilityForm classes={classes} />
      ) : (
        <div className="card p-6 text-sm text-text-muted">
          No active teacher record is linked to your account. Contact your administrator.
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Upcoming slots
        </h2>
        {slots.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            No upcoming slots. Publish your availability above.
          </p>
        ) : (
          <div className="space-y-4">
            {[...byDate.entries()].map(([date, daySlots]) => (
              <div key={date}>
                <p className="mb-2 text-sm font-semibold text-text-primary">{formatDate(date)}</p>
                <ul className="space-y-1.5">
                  {daySlots.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2 text-sm text-text-primary">
                        {formatSlotTime(s.start_time)} – {formatSlotTime(s.end_time)}
                        {s.classes && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {s.classes.name}
                          </span>
                        )}
                      </span>
                      {s.booked_parent_id ? (
                        <span className="text-xs text-text-secondary">
                          Booked —{' '}
                          {[s.profiles?.first_name, s.profiles?.last_name]
                            .filter(Boolean)
                            .join(' ') || 'Parent'}
                          {s.students ? ` (${s.students.first_name} ${s.students.last_name})` : ''}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-text-muted">Free</span>
                          <DeleteSlotButton slotId={s.id} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
