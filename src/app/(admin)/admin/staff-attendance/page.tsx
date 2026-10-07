import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart2 } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'
import { getStaffClockBoard } from '@/lib/staff-attendance/queries'
import { StaffClockBoard } from '@/components/staff-attendance/StaffClockBoard'

export const metadata: Metadata = { title: 'Staff clock-in | Admin' }
export const dynamic = 'force-dynamic'

export default async function StaffAttendancePage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const today = new Date().toISOString().slice(0, 10)
  const dateLabel = new Date().toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Dublin',
  })
  const staff = await getStaffClockBoard(admin.schoolId, today)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff clock-in</h1>
          <p className="mt-1 text-sm text-text-muted">
            Clock each staff member in and out for the day. The times are recorded for the
            timesheet-independent attendance report.
          </p>
        </div>
        <Link
          href="/admin/staff-attendance/report"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          <BarChart2 className="h-4 w-4" /> Report
        </Link>
      </div>
      <StaffClockBoard staff={staff} dateLabel={dateLabel} />
    </div>
  )
}
