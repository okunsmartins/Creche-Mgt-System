import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = await requireAdmin()

  // Advanced reports (CSV export) is a Pro feature.
  if (!admin.schoolId || !(await schoolHasProAccess(admin.schoolId))) {
    return new Response('Upgrade to Pro to export reports.', { status: 403 })
  }

  const adminClient = createSupabaseAdminClient()

  const { data: records } = await adminClient
    .from('attendance_records')
    .select(
      `
      status,
      note,
      students(first_name, last_name),
      attendance_sessions(session_date, notes, classes(name), teachers(first_name, last_name, display_name))
    `,
    )
    .eq('school_id', admin.schoolId!)
    .order('session_id')
    .order('student_id')

  const rows = (records ?? []).map((r) => {
    const student = r.students as unknown as { first_name: string; last_name: string } | null
    const session = r.attendance_sessions as unknown as {
      session_date: string
      notes: string | null
      classes: { name: string } | null
      teachers: { first_name: string; last_name: string; display_name: string | null } | null
    } | null
    const teacherRaw = session?.teachers
    const teacherName = teacherRaw
      ? (teacherRaw.display_name ?? `${teacherRaw.first_name} ${teacherRaw.last_name}`)
      : ''
    return [
      session?.session_date ?? '',
      session?.classes?.name ?? '',
      teacherName,
      student ? `${student.first_name} ${student.last_name}` : '',
      r.status,
      r.note ?? '',
      session?.notes ?? '',
    ]
  })

  const header = ['Date', 'Class', 'Teacher', 'Student', 'Status', 'Note', 'Session Notes']
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
