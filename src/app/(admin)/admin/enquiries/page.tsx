import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { EnquiriesPanel, type EnquiryRow } from '@/components/enquiries/EnquiriesPanel'
import { OPEN_ENQUIRY_STATUSES } from '@/lib/enquiries/enquiries'

export const metadata: Metadata = { title: 'Enquiries' }

export default async function EnquiriesPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>
  const db = createSupabaseAdminClient()

  const { data } = await db
    .from('enquiries')
    .select(
      'id, parent_name, parent_email, parent_phone, child_first_name, child_last_name, desired_start_date, status, notes, source, created_at',
    )
    .eq('school_id', admin.schoolId)
    .order('created_at', { ascending: false })
  const enquiries = (data ?? []) as EnquiryRow[]

  const openCount = enquiries.filter((e) =>
    (OPEN_ENQUIRY_STATUSES as readonly string[]).includes(e.status),
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Enquiries &amp; waiting list</h1>
        <p className="mt-1 text-sm text-text-muted">
          Prospective families before enrolment · {openCount} open of {enquiries.length}.
        </p>
      </div>
      <EnquiriesPanel enquiries={enquiries} />
    </div>
  )
}
