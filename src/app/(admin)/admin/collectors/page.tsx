import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  CollectorsPanel,
  type CollectorRow,
  type ChildOption,
} from '@/components/collectors/CollectorsPanel'

export const metadata: Metadata = { title: 'Authorised Collectors' }

interface RawCollector {
  id: string
  student_id: string
  full_name: string
  relationship: string
  phone: string | null
  status: string
  proposed_by: string
  can_collect_unaccompanied: boolean
  notes: string | null
  created_at: string
  students: { first_name: string | null; last_name: string | null } | null
}

export default async function CollectorsPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()

  const [{ data: collectorData }, { data: childData }] = await Promise.all([
    db
      .from('authorised_collectors')
      .select(
        'id, student_id, full_name, relationship, phone, status, proposed_by, can_collect_unaccompanied, notes, created_at, students(first_name, last_name)',
      )
      .eq('school_id', admin.schoolId)
      .order('created_at', { ascending: false }),
    db
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('last_name'),
  ])

  const collectors: CollectorRow[] = ((collectorData ?? []) as unknown as RawCollector[]).map(
    (c) => ({
      id: c.id,
      studentId: c.student_id,
      childName: [c.students?.first_name, c.students?.last_name].filter(Boolean).join(' ') || '—',
      fullName: c.full_name,
      relationship: c.relationship,
      phone: c.phone,
      status: c.status,
      proposedBy: c.proposed_by,
      canCollectUnaccompanied: c.can_collect_unaccompanied,
      notes: c.notes,
    }),
  )

  const children: ChildOption[] = ((childData ?? []) as ChildOption[]).map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
  }))

  const pendingCount = collectors.filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Authorised collectors</h1>
        <p className="mt-1 text-sm text-text-muted">
          Who may collect each child · {pendingCount} awaiting approval of {collectors.length}{' '}
          total.
        </p>
      </div>
      <CollectorsPanel collectors={collectors} childOptions={children} />
    </div>
  )
}
