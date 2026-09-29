import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Upload, Lock } from 'lucide-react'
import type { StudentRow, ClassRow } from '@/types/database'

export const metadata: Metadata = { title: 'Children' }

const PAGE_SIZE = 25

type StudentWithClass = Pick<
  StudentRow,
  'id' | 'first_name' | 'last_name' | 'pupil_payment_code' | 'is_active' | 'class_id'
> & { classes: { name: string } | null }

type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; classId?: string; status?: string }>
}

export default async function AdminStudentsPage({ searchParams }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }
  const isPro = await schoolHasProAccess(admin.schoolId)

  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const classId = params.classId ?? ''
  const status = params.status ?? 'active'
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = createSupabaseAdminClient()

  // Fetch classes for the filter dropdown
  const classesResult = await supabase
    .from('classes')
    .select('id, name, display_order')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('display_order')
  const classes = classesResult.data as ClassOption[] | null

  // Build student query with optional filters
  let query = supabase
    .from('students')
    .select('id, first_name, last_name, pupil_payment_code, is_active, class_id, classes(name)')
    .eq('school_id', admin.schoolId)
    .order('last_name')
    .order('first_name')
    .range(from, to)

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,pupil_payment_code.ilike.%${q}%`,
    )
  }
  if (classId) query = query.eq('class_id', classId)
  if (status === 'active') query = query.eq('is_active', true)
  else if (status === 'inactive') query = query.eq('is_active', false)

  const { data: rawStudents, error } = await query
  const students = rawStudents as StudentWithClass[] | null

  if (error) {
    return <p className="text-error">Failed to load children. Please refresh.</p>
  }

  const hasMore = (students?.length ?? 0) === PAGE_SIZE
  const filterBase = new URLSearchParams({ ...(q && { q }), ...(classId && { classId }), status })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Children</h1>
        <div className="flex items-center gap-2">
          {isPro ? (
            <Link
              href="/admin/students/import"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import CSV
            </Link>
          ) : (
            <Link
              href="/pricing?locked=csv_import"
              title="CSV import is a Pro feature"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-text-muted hover:border-primary/40 hover:text-primary"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Import CSV (Pro)
            </Link>
          )}
          <Button asChild>
            <Link href="/admin/students/new">Add child</Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="mb-5 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or code…"
          className="input-base h-9 w-56"
          suppressHydrationWarning
        />
        <select name="classId" defaultValue={classId} className="input-base h-9">
          <option value="">All classes</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="input-base h-9">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <button type="submit" className="btn-primary h-9 px-4 text-sm">
          Filter
        </button>
        <Link href="/admin/students" className="btn-outline h-9 px-4 text-sm">
          Clear
        </Link>
      </form>

      {/* Table */}
      {students?.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-text-muted">No children found.</p>
          {(q || classId || status !== 'active') && (
            <Link
              href="/admin/students"
              className="mt-2 block text-sm text-primary hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Class
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Pupil code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(students ?? []).map((student) => (
                <tr key={student.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {student.last_name}, {student.first_name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {student.classes?.name ?? <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {student.pupil_payment_code}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={student.is_active ? 'success' : 'default'}>
                      {student.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/students?${filterBase.toString()}&page=${page - 1}`}
              className="text-primary hover:underline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link
              href={`/admin/students?${filterBase.toString()}&page=${page + 1}`}
              className="text-primary hover:underline"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
