import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StudentForm } from '@/components/students/StudentForm'
import { StudentStatusToggle } from '@/components/students/StudentStatusToggle'
import { RegeneratePupilCode } from '@/components/students/RegeneratePupilCode'
import { AdminLinkParent } from '@/components/students/AdminLinkParent'
import { ParentMessageForm } from '@/components/messages/ParentMessageForm'
import { StatusBadge } from '@/components/ui/Badge'
import { AssignmentFileRow } from '@/components/assignments/AssignmentFileRow'
import { getStudentAssignments } from '@/lib/assignments/queries'
import { DocumentFileRow } from '@/components/documents/DocumentFileRow'
import { DocumentDeleteButton } from '@/components/documents/DocumentDeleteButton'
import { StudentDocumentUploader } from '@/components/documents/StudentDocumentUploader'
import { getStudentDocuments } from '@/lib/documents/queries'
import { fundingEnabled, hasFundingPermission } from '@/lib/funding/access'
import { getChildFundingSummary } from '@/lib/funding/queries'
import { ChildFundingPanel } from '@/components/funding/ChildFundingPanel'
import { updateStudentAction } from '@/lib/students/actions'
import type {
  StudentRow,
  ClassRow,
  ParentStudentLinkRow,
  ProfileRow,
  OrderRow,
} from '@/types/database'
import type { SelectOption } from '@/types'

export const metadata: Metadata = { title: 'Edit Child' }

type StudentDetail = Pick<
  StudentRow,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'class_id'
  | 'pupil_payment_code'
  | 'is_active'
  | 'parent_mobile'
  | 'emergency_contact_name'
  | 'emergency_contact_phone'
  | 'emergency_contact_relationship'
  | 'allergies'
  | 'dietary_needs'
  | 'medical_conditions'
  | 'medication_consent'
  | 'medication_notes'
  | 'session'
>
type ClassOption = Pick<ClassRow, 'id' | 'name' | 'display_order'>
type LinkedParent = Pick<ParentStudentLinkRow, 'id' | 'created_at'> & {
  profiles: Pick<ProfileRow, 'first_name' | 'last_name' | 'email'> | null
}
type OrderPaymentSummary = Pick<
  OrderRow,
  'id' | 'order_reference' | 'total_cents' | 'amount_paid_cents' | 'status' | 'created_at'
> & { activity_name: string; unit_amount_cents: number }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditStudentPage({ params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  const [studentResult, classesResult, linksResult, orderItemsResult] = await Promise.all([
    supabase
      .from('students')
      .select(
        'id, first_name, last_name, class_id, pupil_payment_code, is_active, parent_mobile, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, allergies, dietary_needs, medical_conditions, medication_consent, medication_notes, session',
      )
      .eq('id', id)
      .eq('school_id', admin.schoolId)
      .single(),
    supabase
      .from('classes')
      .select('id, name, display_order')
      .eq('school_id', admin.schoolId)
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('parent_student_links')
      .select('id, created_at, profiles!parent_id(first_name, last_name, email)')
      .eq('student_id', id)
      .eq('is_active', true)
      .order('created_at'),
    supabase
      .from('order_items')
      .select(
        'activity_name_snapshot, unit_amount_cents, orders!inner(id, order_reference, total_cents, amount_paid_cents, status, created_at, school_id)',
      )
      .eq('student_id', id)
      .eq('orders.school_id', admin.schoolId)
      .order('created_at', { referencedTable: 'orders', ascending: false })
      .limit(20),
  ])

  const student = studentResult.data as StudentDetail | null
  const rawClasses = classesResult.data as ClassOption[] | null
  const linkedParents = linksResult.data as LinkedParent[] | null

  type RawOrderItem = {
    activity_name_snapshot: string
    unit_amount_cents: number
    orders: Pick<
      OrderRow,
      'id' | 'order_reference' | 'total_cents' | 'amount_paid_cents' | 'status' | 'created_at'
    > & { school_id: string }
  }
  const rawOrderItems = (orderItemsResult.data as unknown as RawOrderItem[]) ?? []

  // Deduplicate by order id — a student may have multiple items in one order
  const seenOrderIds = new Set<string>()
  const studentOrders: OrderPaymentSummary[] = []
  for (const item of rawOrderItems) {
    if (!item.orders || seenOrderIds.has(item.orders.id)) continue
    seenOrderIds.add(item.orders.id)
    studentOrders.push({
      ...item.orders,
      activity_name: item.activity_name_snapshot,
      unit_amount_cents: item.unit_amount_cents,
    })
  }

  if (!student) notFound()

  const assignments = await getStudentAssignments(student.id, admin.schoolId)
  const testResults = await getStudentDocuments(student.id, 'test_result', admin.schoolId)
  const reportCards = await getStudentDocuments(student.id, 'report_card', admin.schoolId)

  // Funding summary — only for tenants with the Hive Centre enabled, to funding.view admins.
  const showFunding =
    hasFundingPermission(admin, 'funding.view') && (await fundingEnabled(admin.schoolId))
  const fundingSummary = showFunding
    ? await getChildFundingSummary(admin.schoolId, student.id)
    : null

  const classOptions: SelectOption[] = (rawClasses ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))

  return (
    <div className="mx-auto max-w-xl">
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/admin/students" className="hover:text-primary hover:underline">
          Children
        </Link>
        {' / '}
        <span className="text-text-primary">
          {student.last_name}, {student.first_name}
        </span>
      </nav>

      <h1 className="mb-1 text-2xl font-bold text-text-primary">Edit child</h1>
      <p className="mb-6 font-mono text-sm text-text-muted">{student.pupil_payment_code}</p>

      <StudentForm
        action={updateStudentAction}
        classes={classOptions}
        student={{
          id: student.id,
          firstName: student.first_name,
          lastName: student.last_name,
          classId: student.class_id,
          parentMobile: student.parent_mobile,
          emergencyContactName: student.emergency_contact_name,
          emergencyContactPhone: student.emergency_contact_phone,
          emergencyContactRelationship: student.emergency_contact_relationship,
          allergies: student.allergies,
          dietaryNeeds: student.dietary_needs,
          medicalConditions: student.medical_conditions,
          medicationConsent: student.medication_consent,
          medicationNotes: student.medication_notes,
          session: student.session,
        }}
      />

      <hr className="my-8 border-border" />

      {/* Pupil code regeneration */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Pupil payment code</h2>
        <p className="text-sm text-text-muted">
          Regenerating this code will invalidate the old code immediately. Give the new code to the
          parent so they can re-submit a link request if needed.
        </p>
        <RegeneratePupilCode studentId={student.id} currentCode={student.pupil_payment_code} />
      </section>

      <hr className="my-8 border-border" />

      {/* Activate / Deactivate */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">
          {student.is_active ? 'Deactivate student' : 'Reactivate student'}
        </h2>
        <p className="text-sm text-text-muted">
          {student.is_active
            ? 'Deactivating hides the student from activity listings and prevents new payments. Existing data is preserved.'
            : 'Reactivating makes the student visible again and allows new payments.'}
        </p>
        <StudentStatusToggle studentId={student.id} isActive={student.is_active} />
      </section>

      <hr className="my-8 border-border" />

      {/* Linked parents */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Linked parents</h2>

        {(linkedParents?.length ?? 0) > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Linked
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(linkedParents ?? []).map((link) => (
                  <tr key={link.id}>
                    <td className="px-3 py-2 text-text-primary">
                      {link.profiles?.first_name} {link.profiles?.last_name}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-secondary">
                      {link.profiles?.email}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-muted">
                      {new Date(link.created_at).toLocaleDateString('en-IE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm text-text-muted">
          Enter a parent&apos;s registered email address to link them directly to this student
          without requiring a link request.
        </p>
        <AdminLinkParent studentId={student.id} />

        {/* Message this pupil's linked parents by email (uses the parent-messaging
            'student' audience). Only shown when at least one parent is linked. */}
        {(linkedParents?.length ?? 0) > 0 && (
          <details className="mt-2 overflow-hidden rounded-lg border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text-primary hover:bg-surface-raised">
              Message {student.first_name}&apos;s parents
            </summary>
            <div className="border-t border-border p-4">
              <ParentMessageForm
                fixedStudent={{
                  id: student.id,
                  name: `${student.first_name} ${student.last_name}`,
                }}
              />
            </div>
          </details>
        )}
      </section>

      <hr className="my-8 border-border" />

      {/* Payment history */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Payment history</h2>

        {studentOrders.length === 0 ? (
          <p className="text-sm text-text-muted">No orders for this student yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Order ref
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Activity
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Date
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                    Paid
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-text-muted">
                    Remaining
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {studentOrders.map((order) => {
                  const remaining = order.total_cents - order.amount_paid_cents
                  return (
                    <tr key={order.id}>
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-primary hover:underline"
                        >
                          {order.order_reference}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-text-primary">{order.activity_name}</td>
                      <td className="px-3 py-2 text-xs text-text-secondary">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary">
                        {formatCurrency(order.total_cents)}
                      </td>
                      <td className="px-3 py-2 text-right text-success">
                        {order.amount_paid_cents > 0
                          ? formatCurrency(order.amount_paid_cents)
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary">
                        {remaining > 0 && order.status !== 'cancelled' && order.status !== 'expired'
                          ? formatCurrency(remaining)
                          : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {fundingSummary && (
        <>
          <hr className="my-8 border-border" />
          <ChildFundingPanel summary={fundingSummary} />
        </>
      )}

      <hr className="my-8 border-border" />

      {/* Submitted work (assignments uploaded by this pupil's parents) */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Submitted work</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-text-muted">No assignments uploaded for this student yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {assignments.map((a) => (
              <AssignmentFileRow key={a.id} assignment={a} />
            ))}
          </ul>
        )}
      </section>

      <hr className="my-8 border-border" />

      {/* Test results (staff-uploaded documents parents can view) */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Test results</h2>
        <p className="text-sm text-text-muted">
          Upload a test result (PDF or image). The pupil&apos;s linked parents can view it.
        </p>
        {testResults.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {testResults.map((d) => (
              <DocumentFileRow
                key={d.id}
                doc={d}
                action={<DocumentDeleteButton documentId={d.id} />}
              />
            ))}
          </ul>
        )}
        <StudentDocumentUploader
          studentId={student.id}
          category="test_result"
          titleLabel="Title (optional)"
          titlePlaceholder="e.g. Maths test – October"
        />
      </section>

      <hr className="my-8 border-border" />

      {/* Report cards (staff-uploaded documents parents can view) */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Report cards</h2>
        <p className="text-sm text-text-muted">
          Upload an end-of-term development report (PDF or image). The pupil&apos;s linked parents
          can view it.
        </p>
        {reportCards.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {reportCards.map((d) => (
              <DocumentFileRow
                key={d.id}
                doc={d}
                action={<DocumentDeleteButton documentId={d.id} />}
              />
            ))}
          </ul>
        )}
        <StudentDocumentUploader
          studentId={student.id}
          category="report_card"
          titleLabel="Title (optional)"
          titlePlaceholder="e.g. End-of-year report"
          showTerm
        />
      </section>
    </div>
  )
}
