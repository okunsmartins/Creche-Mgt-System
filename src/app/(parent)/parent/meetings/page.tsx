import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { BookSlotButton, CancelBookingButton } from '@/components/meetings/SlotButtons'
import { formatSlotTime, isSlotInFuture, schoolNow } from '@/lib/meetings/slots'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Meetings' }

type ChildRow = {
  students: {
    id: string
    first_name: string
    last_name: string
    is_active: boolean
    class_id: string
    classes: {
      name: string
      teacher_id: string | null
      teachers: { first_name: string; last_name: string; display_name: string | null } | null
    } | null
  } | null
}

type FreeSlot = {
  id: string
  teacher_id: string
  class_id: string | null
  slot_date: string
  start_time: string
  end_time: string
}

type BookingRow = {
  id: string
  slot_date: string
  start_time: string
  end_time: string
  teachers: { first_name: string; last_name: string; display_name: string | null } | null
  students: { first_name: string; last_name: string } | null
}

function teacherLabel(
  t: { first_name: string; last_name: string; display_name: string | null } | null,
): string {
  if (!t) return 'Teacher'
  return t.display_name ?? `${t.first_name} ${t.last_name}`
}

export default async function ParentMeetingsPage() {
  const user = await requireVerifiedAuth()

  // Admin client scoped to the user id — auth.uid() is null in Server Components
  // (same pattern as the other parent pages).
  const adminClient = createSupabaseAdminClient()
  const { today, nowTime } = schoolNow()

  const [childrenResult, bookingsResult] = await Promise.all([
    adminClient
      .from('parent_student_links')
      .select(
        'students(id, first_name, last_name, is_active, class_id, classes(name, teacher_id, teachers(first_name, last_name, display_name)))',
      )
      .eq('parent_id', user.id)
      .eq('is_active', true),
    adminClient
      .from('meeting_slots')
      .select(
        'id, slot_date, start_time, end_time, teachers(first_name, last_name, display_name), students!booked_student_id(first_name, last_name)',
      )
      .eq('booked_parent_id', user.id)
      .gte('slot_date', today)
      .order('slot_date')
      .order('start_time'),
  ])

  const children = ((childrenResult.data as ChildRow[] | null) ?? [])
    .map((r) => r.students)
    .filter(
      (s): s is NonNullable<ChildRow['students']> => !!s && s.is_active && !!s.classes?.teacher_id,
    )
  const bookings = ((bookingsResult.data as BookingRow[] | null) ?? []).filter((b) =>
    isSlotInFuture(b.slot_date, b.start_time, today, nowTime),
  )

  // Free future slots for each child's class teacher (deduped across children
  // sharing a teacher).
  const teacherIds = [...new Set(children.map((c) => c.classes!.teacher_id!))]
  let freeSlots: FreeSlot[] = []
  if (teacherIds.length > 0) {
    const { data } = await adminClient
      .from('meeting_slots')
      .select('id, teacher_id, class_id, slot_date, start_time, end_time')
      .in('teacher_id', teacherIds)
      .is('booked_parent_id', null)
      .gte('slot_date', today)
      .order('slot_date')
      .order('start_time')
      .limit(200)
    freeSlots = ((data as FreeSlot[] | null) ?? []).filter((s) =>
      isSlotInFuture(s.slot_date, s.start_time, today, nowTime),
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Parent–teacher meetings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Book a meeting with your child&apos;s class teacher from their available times.
        </p>
      </div>

      {/* My bookings */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-text-muted">
          Your upcoming meetings
        </h2>
        {bookings.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            You have no meetings booked.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {bookings.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {formatDate(b.slot_date)} · {formatSlotTime(b.start_time)} –{' '}
                    {formatSlotTime(b.end_time)}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {teacherLabel(b.teachers)}
                    {b.students ? ` · for ${b.students.first_name} ${b.students.last_name}` : ''}
                  </p>
                </div>
                <CancelBookingButton slotId={b.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Available slots per child */}
      {children.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          No linked children with an assigned class teacher yet. Link your child under My Children
          first.
        </p>
      ) : (
        children.map((child) => {
          // The child's teacher's slots, excluding slots targeted at a different class.
          const childSlots = freeSlots.filter(
            (s) =>
              s.teacher_id === child.classes!.teacher_id &&
              (s.class_id === null || s.class_id === child.class_id),
          )
          return (
            <div key={child.id}>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-text-muted">
                {child.first_name} {child.last_name}
              </h2>
              <p className="mb-3 text-xs text-text-muted">
                {child.classes!.name} · {teacherLabel(child.classes!.teachers)}
              </p>
              {childSlots.length === 0 ? (
                <p className="rounded-md border border-border bg-surface px-4 py-4 text-center text-sm text-text-muted">
                  No available times right now — check back later.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {childSlots.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
                    >
                      <span className="text-sm text-text-primary">
                        {formatDate(s.slot_date)} · {formatSlotTime(s.start_time)} –{' '}
                        {formatSlotTime(s.end_time)}
                      </span>
                      <BookSlotButton slotId={s.id} studentId={child.id} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
