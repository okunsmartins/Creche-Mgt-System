import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  DailyRecordsPanel,
  type DailyRecordRow,
} from '@/components/daily-records/DailyRecordsPanel'
import { isDailyRecordType } from '@/lib/daily-records/records'

export const metadata: Metadata = { title: 'Daily records' }

interface ChildRow {
  id: string
  first_name: string
  last_name: string
}
interface RecordRow {
  id: string
  type: string
  note: string | null
  recorded_at: string
}

interface PageProps {
  searchParams: Promise<{ child?: string }>
}

export default async function DailyRecordsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()
  const { child: selectedId } = await searchParams
  const todayISO = new Date().toISOString().slice(0, 10)

  const { data: childData } = await db
    .from('students')
    .select('id, first_name, last_name')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('last_name')
  const children = (childData ?? []) as ChildRow[]

  const selected = children.find((c) => c.id === selectedId) ?? null

  let records: DailyRecordRow[] = []
  if (selected) {
    const { data: recData } = await db
      .from('daily_records')
      .select('id, type, note, recorded_at')
      .eq('school_id', admin.schoolId)
      .eq('student_id', selected.id)
      .eq('date', todayISO)
      .order('recorded_at', { ascending: false })
    records = ((recData ?? []) as RecordRow[])
      .filter((r) => isDailyRecordType(r.type))
      .map((r) => ({
        id: r.id,
        type: r.type as DailyRecordRow['type'],
        note: r.note,
        recorded_at: r.recorded_at,
      }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Daily records</h1>
          <p className="mt-1 text-sm text-text-muted">
            Log sleep, nappies, meals, incidents and medication for each child.
          </p>
        </div>
        <Link
          href="/admin/daily-records/report"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-primary hover:text-primary"
        >
          Reports (day / week / month)
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="form-label">Child</span>
          <select
            name="child"
            defaultValue={selected?.id ?? ''}
            className="input-base bg-[right_0.5rem_center] pr-8"
          >
            <option value="" disabled>
              Select a child…
            </option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          View
        </button>
      </form>

      {selected ? (
        <>
          <h2 className="text-lg font-semibold text-text-primary">
            {selected.first_name} {selected.last_name}
          </h2>
          <DailyRecordsPanel studentId={selected.id} records={records} />
        </>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          {children.length === 0
            ? 'No children enrolled yet.'
            : 'Choose a child to view and add records.'}
        </div>
      )}
    </div>
  )
}
