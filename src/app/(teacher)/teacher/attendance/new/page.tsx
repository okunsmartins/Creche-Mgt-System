import type { Metadata } from 'next'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses, selectTeacherClass } from '@/lib/teachers/classes'
import { ClassSwitcher } from '@/components/teacher/ClassSwitcher'
import { AttendanceForm } from '@/components/attendance/AttendanceForm'

export const metadata: Metadata = { title: 'Mark Attendance' }

export default async function NewAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string }>
}) {
  const user = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const { classId } = await searchParams

  const teacherClasses = await resolveTeacherClasses(adminClient, user.email)
  const classes = teacherClasses?.classes ?? []
  const assignedClass = selectTeacherClass(classes, classId)

  if (!assignedClass) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text-primary">Mark Attendance</h1>
        <div className="rounded-2xl bg-amber-500/10 px-5 py-4 ring-1 ring-amber-500/20">
          <p className="text-sm text-amber-300">
            No class assigned to your account. Contact the school administrator.
          </p>
        </div>
      </div>
    )
  }

  const { data: students } = await adminClient
    .from('students')
    .select('id, first_name, last_name')
    .eq('class_id', assignedClass.id)
    .eq('is_active', true)
    .order('last_name')
    .order('first_name')

  const todayStr = new Date().toISOString().slice(0, 10)

  // Pre-load today's session if it exists (for re-marking)
  const { data: existingSession } = await adminClient
    .from('attendance_sessions')
    .select('id, notes')
    .eq('class_id', assignedClass.id)
    .eq('session_date', todayStr)
    .maybeSingle()

  const { data: existingRecords } = existingSession
    ? await adminClient
        .from('attendance_records')
        .select('student_id, status, note')
        .eq('session_id', existingSession.id)
    : { data: [] }

  const mappedRecords = (existingRecords ?? []).map((r) => ({
    studentId: r.student_id,
    status: r.status as 'present' | 'absent' | 'late',
    note: r.note ?? undefined,
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Mark Attendance</h1>
        <p className="mt-1 text-sm text-text-muted">
          {assignedClass.name} · {(students ?? []).length} students
        </p>
      </div>
      {classes.length > 1 && (
        <ClassSwitcher
          classes={classes}
          selectedId={assignedClass.id}
          basePath="/teacher/attendance/new"
        />
      )}
      <AttendanceForm
        classId={assignedClass.id}
        className={assignedClass.name}
        students={students ?? []}
        defaultDate={todayStr}
        existingRecords={mappedRecords}
        existingSessionNotes={existingSession?.notes ?? undefined}
      />
    </div>
  )
}
