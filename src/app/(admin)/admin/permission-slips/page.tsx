import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getSchoolSlips } from '@/lib/permission-slips/queries'
import { PermissionSlipForm } from '@/components/permission-slips/PermissionSlipForm'
import { PermissionSlipDeleteButton } from '@/components/permission-slips/PermissionSlipDeleteButton'
import type { SelectOption } from '@/types'

export const metadata: Metadata = { title: 'Permission Slips | Admin' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function AdminPermissionSlipsPage() {
  const admin = await requireAdmin()
  if (!admin.schoolId) {
    return (
      <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
        No school is associated with your account.
      </p>
    )
  }

  const supabase = createSupabaseAdminClient()
  const { data: classData } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', admin.schoolId)
    .eq('is_active', true)
    .order('display_order')
  const classes: SelectOption[] = ((classData as { id: string; name: string }[] | null) ?? []).map(
    (c) => ({ value: c.id, label: c.name }),
  )
  const slips = await getSchoolSlips(admin.schoolId)

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Permission slips</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ask parents to grant or decline consent for an activity, then track responses.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold text-text-primary">New permission slip</h2>
        <PermissionSlipForm classes={classes} allowSchool />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-text-primary">Slips</h2>
        {slips.length === 0 ? (
          <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
            No permission slips yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {slips.map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/permission-slips/${s.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {s.title}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {s.audienceLabel}
                      {s.dueDate ? ` · due ${formatDate(s.dueDate)}` : ''}
                    </p>
                  </div>
                  <PermissionSlipDeleteButton slipId={s.id} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-success">
                    {s.tally.granted} granted
                  </span>
                  <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-error">
                    {s.tally.declined} declined
                  </span>
                  <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-text-muted ring-1 ring-border">
                    {s.tally.pending} awaiting
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
