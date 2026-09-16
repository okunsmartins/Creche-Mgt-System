'use server'

import { revalidatePath } from 'next/cache'
import { requireTeacher, requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { availabilityBlockSchema, type MeetingActionState } from './schemas'
import {
  generateMeetingSlots,
  filterNonOverlappingSlots,
  isSlotInFuture,
  schoolNow,
  type ExistingSlotTimes,
} from './slots'
import { sendMeetingBookedEmails, sendMeetingCancelledEmail } from './emails'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function resolveTeacherId(adminClient: AdminClient, email: string): Promise<string | null> {
  const { data } = await adminClient
    .from('teachers')
    .select('id')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Teacher publishes an availability block; the server generates the discrete
 * slots. Duplicate slots (same teacher/date/start) are skipped via
 * ON CONFLICT DO NOTHING, so republishing an overlapping block is safe.
 */
export async function createAvailabilityAction(
  _prev: MeetingActionState,
  formData: FormData,
): Promise<MeetingActionState> {
  const user = await requireTeacher()
  if (!user.schoolId) return { error: 'Your account is not linked to a school.' }

  const parsed = availabilityBlockSchema.safeParse({
    slotDate: formData.get('slotDate'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    durationMins: formData.get('durationMins'),
    classId: formData.get('classId') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' }
  }
  const { slotDate, startTime, endTime, durationMins, classId } = parsed.data

  const { today } = schoolNow()
  if (slotDate < today) return { error: 'The date cannot be in the past.' }

  const slots = generateMeetingSlots(startTime, endTime, durationMins)
  if (!slots) return { error: 'That time window does not fit any slots of the chosen length.' }

  const adminClient = createSupabaseAdminClient()
  const teacherId = await resolveTeacherId(adminClient, user.email)
  if (!teacherId) return { error: 'No active teacher record found for your account.' }

  // When targeting one class, it must be THIS teacher's own class (school-scoped).
  if (classId) {
    const { data: cls } = await adminClient
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacherId)
      .eq('school_id', user.schoolId)
      .maybeSingle()
    if (!cls) return { error: 'You can only publish slots for your own classes.' }
  }

  // Drop slots that would OVERLAP the teacher's existing slots on this day —
  // the UNIQUE constraint only catches identical start times, not overlaps
  // (e.g. republishing the same window with a different slot length).
  const { data: existingData } = await adminClient
    .from('meeting_slots')
    .select('start_time, end_time')
    .eq('teacher_id', teacherId)
    .eq('slot_date', slotDate)
  const nonOverlapping = filterNonOverlappingSlots(
    slots,
    (existingData as ExistingSlotTimes[] | null) ?? [],
  )
  if (nonOverlapping.length === 0) {
    return { success: true, created: 0 }
  }

  const rows = nonOverlapping.map((s) => ({
    school_id: user.schoolId!,
    teacher_id: teacherId,
    class_id: classId ?? null,
    slot_date: slotDate,
    start_time: s.start,
    end_time: s.end,
    booked_parent_id: null,
    booked_student_id: null,
    booked_at: null,
  }))

  const { data: inserted, error } = await adminClient
    .from('meeting_slots')
    .upsert(rows, { onConflict: 'teacher_id,slot_date,start_time', ignoreDuplicates: true })
    .select('id')
  if (error) {
    logger.error('meeting_slots_create_failed', { schoolId: user.schoolId, error: error.message })
    return { error: 'Could not publish your availability. Please try again.' }
  }

  revalidatePath('/teacher/meetings')
  revalidatePath('/parent/meetings')
  return { success: true, created: (inserted ?? []).length }
}

/** Teacher removes one of their own UNBOOKED slots. */
export async function deleteSlotAction(slotId: string): Promise<MeetingActionState> {
  const user = await requireTeacher()
  if (!user.schoolId) return { error: 'Your account is not linked to a school.' }

  const adminClient = createSupabaseAdminClient()
  const teacherId = await resolveTeacherId(adminClient, user.email)
  if (!teacherId) return { error: 'No active teacher record found for your account.' }

  const { data: deleted, error } = await adminClient
    .from('meeting_slots')
    .delete()
    .eq('id', slotId)
    .eq('teacher_id', teacherId)
    .is('booked_parent_id', null)
    .select('id')
  if (error) {
    logger.error('meeting_slot_delete_failed', { slotId, error: error.message })
    return { error: 'Could not remove the slot. Please try again.' }
  }
  if (!deleted || deleted.length === 0) {
    return { error: 'Slot not found, or it has already been booked.' }
  }

  revalidatePath('/teacher/meetings')
  revalidatePath('/parent/meetings')
  return { success: true }
}

/**
 * Parent books a slot for one of their linked children. Eligibility is verified
 * server-side (active link → active student → the student's class teacher must
 * own the slot), and the claim is an ATOMIC conditional update — if two parents
 * race, exactly one wins and the other gets "just taken".
 */
export async function bookSlotAction(
  slotId: string,
  studentId: string,
): Promise<MeetingActionState> {
  const user = await requireVerifiedAuth()

  const adminClient = createSupabaseAdminClient()

  // Slot must exist and be in the future.
  const { data: slotData } = await adminClient
    .from('meeting_slots')
    .select(
      'id, school_id, teacher_id, class_id, slot_date, start_time, end_time, booked_parent_id, teachers(first_name, last_name, display_name, email)',
    )
    .eq('id', slotId)
    .maybeSingle()
  const slot = slotData as {
    id: string
    school_id: string
    teacher_id: string
    class_id: string | null
    slot_date: string
    start_time: string
    end_time: string
    booked_parent_id: string | null
    teachers: {
      first_name: string
      last_name: string
      display_name: string | null
      email: string | null
    } | null
  } | null
  if (!slot) return { error: 'Slot not found.' }
  if (slot.booked_parent_id) return { error: 'That slot has already been booked.' }

  const { today, nowTime } = schoolNow()
  if (!isSlotInFuture(slot.slot_date, slot.start_time, today, nowTime)) {
    return { error: 'That slot is in the past.' }
  }

  // Eligibility: the child must be actively linked to this parent, active, in the
  // slot's school, and taught by the slot's teacher.
  const { data: linkData } = await adminClient
    .from('parent_student_links')
    .select(
      'id, students(id, first_name, last_name, is_active, school_id, class_id, classes(teacher_id))',
    )
    .eq('parent_id', user.id)
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle()
  type LinkCheck = {
    students: {
      first_name: string
      last_name: string
      is_active: boolean
      school_id: string
      class_id: string
      classes: { teacher_id: string | null } | null
    } | null
  }
  const link = linkData as LinkCheck | null
  const student = link?.students
  if (
    !student ||
    !student.is_active ||
    student.school_id !== slot.school_id ||
    student.classes?.teacher_id !== slot.teacher_id
  ) {
    return { error: "You can only book with your child's own class teacher." }
  }
  // Class-targeted slot: the child must be in THAT class.
  if (slot.class_id && student.class_id !== slot.class_id) {
    return { error: "That time is reserved for another class's parents." }
  }

  // Atomic claim: succeeds for exactly one caller.
  const { data: claimed, error } = await adminClient
    .from('meeting_slots')
    .update({
      booked_parent_id: user.id,
      booked_student_id: studentId,
      booked_at: new Date().toISOString(),
    })
    .eq('id', slotId)
    .is('booked_parent_id', null)
    .select('id')
  if (error) {
    logger.error('meeting_slot_book_failed', { slotId, error: error.message })
    return { error: 'Could not book the slot. Please try again.' }
  }
  if (!claimed || claimed.length === 0) {
    return { error: 'That slot has just been taken. Please choose another.' }
  }

  logger.info('meeting_slot_booked', { slotId, schoolId: slot.school_id })

  // Confirmation to the parent + notification to the teacher (best-effort).
  const parentName =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ').trim() || user.email
  await sendMeetingBookedEmails(
    slot.school_id,
    { parentEmail: user.email, teacherEmail: slot.teachers?.email ?? null },
    {
      slotDate: slot.slot_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      teacherName: slot.teachers
        ? (slot.teachers.display_name ?? `${slot.teachers.first_name} ${slot.teachers.last_name}`)
        : 'your teacher',
      parentName,
      childName: `${student.first_name} ${student.last_name}`,
    },
    adminClient,
  )

  revalidatePath('/parent/meetings')
  revalidatePath('/teacher/meetings')
  return { success: true }
}

/** Parent cancels their own FUTURE booking, freeing the slot. */
export async function cancelBookingAction(slotId: string): Promise<MeetingActionState> {
  const user = await requireVerifiedAuth()

  const adminClient = createSupabaseAdminClient()
  const { data: slotData } = await adminClient
    .from('meeting_slots')
    .select(
      'id, slot_date, start_time, end_time, booked_parent_id, school_id, teachers(first_name, last_name, display_name, email), students!booked_student_id(first_name, last_name)',
    )
    .eq('id', slotId)
    .eq('booked_parent_id', user.id)
    .maybeSingle()
  const slot = slotData as {
    slot_date: string
    start_time: string
    end_time: string
    school_id: string
    teachers: {
      first_name: string
      last_name: string
      display_name: string | null
      email: string | null
    } | null
    students: { first_name: string; last_name: string } | null
  } | null
  if (!slot) return { error: 'Booking not found.' }

  const { today, nowTime } = schoolNow()
  if (!isSlotInFuture(slot.slot_date, slot.start_time, today, nowTime)) {
    return { error: 'Past meetings cannot be cancelled.' }
  }

  const { data: cleared, error } = await adminClient
    .from('meeting_slots')
    .update({ booked_parent_id: null, booked_student_id: null, booked_at: null })
    .eq('id', slotId)
    .eq('booked_parent_id', user.id)
    .select('id')
  if (error) {
    logger.error('meeting_slot_cancel_failed', { slotId, error: error.message })
    return { error: 'Could not cancel the booking. Please try again.' }
  }
  if (!cleared || cleared.length === 0) return { error: 'Booking not found.' }

  logger.info('meeting_slot_cancelled', { slotId, schoolId: slot.school_id })

  // Tell the teacher the slot is free again (best-effort).
  const parentName =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(' ').trim() || user.email
  await sendMeetingCancelledEmail(
    slot.school_id,
    slot.teachers?.email ?? null,
    {
      slotDate: slot.slot_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      teacherName: slot.teachers
        ? (slot.teachers.display_name ?? `${slot.teachers.first_name} ${slot.teachers.last_name}`)
        : 'Teacher',
      parentName,
      childName: slot.students
        ? `${slot.students.first_name} ${slot.students.last_name}`
        : 'your child',
    },
    adminClient,
  )

  revalidatePath('/parent/meetings')
  revalidatePath('/teacher/meetings')
  return { success: true }
}
