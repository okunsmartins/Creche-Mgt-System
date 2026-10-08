import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isDailyRecordType, type DailyRecordType } from './records'
import { summariseDailyRecords, type DailyRecordInputRow, type DailyRecordsSummary } from './report'

export interface DailyRecordEntry {
  date: string
  time: string // HH:MM
  childName: string
  type: DailyRecordType
  note: string | null
}

export interface DailyRecordsReport extends DailyRecordsSummary {
  entries: DailyRecordEntry[]
}

type Row = {
  type: string
  note: string | null
  recorded_at: string
  date: string
  student_id: string
  students: { first_name: string; last_name: string } | null
}

/**
 * Daily-records report for a date window [fromISO, toISO] (inclusive), school-scoped.
 * Returns per-child + per-type counts (for week/month summaries) and the raw entry
 * list (for the day view and the CSV). Tolerant of the table being absent pre-migration.
 */
export async function getDailyRecordsReport(
  schoolId: string,
  fromISO: string,
  toISO: string,
): Promise<DailyRecordsReport> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('daily_records')
    .select('type, note, recorded_at, date, student_id, students(first_name, last_name)')
    .eq('school_id', schoolId)
    .gte('date', fromISO)
    .lte('date', toISO)
    .order('recorded_at', { ascending: true })

  const rows = ((data ?? []) as unknown as Row[]).filter((r) => isDailyRecordType(r.type))

  const name = (r: Row) =>
    r.students ? `${r.students.first_name} ${r.students.last_name}` : 'Child'

  const inputs: DailyRecordInputRow[] = rows.map((r) => ({
    studentId: r.student_id,
    studentName: name(r),
    type: r.type as DailyRecordType,
    recordedAt: r.recorded_at,
  }))

  const entries: DailyRecordEntry[] = rows.map((r) => ({
    date: r.date,
    time: new Date(r.recorded_at).toISOString().slice(11, 16),
    childName: name(r),
    type: r.type as DailyRecordType,
    note: r.note,
  }))

  return { ...summariseDailyRecords(inputs), entries }
}
