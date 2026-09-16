import type { Metadata } from 'next'
import Link from 'next/link'
import { requireTeacher } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveTeacherClasses } from '@/lib/teachers/classes'
import { getTeacherSlips } from '@/lib/permission-slips/queries'
import { PermissionSlipForm } from '@/components/permission-slips/PermissionSlipForm'
import { PermissionSlipDeleteButton } from '@/components/permission-slips/PermissionSlipDeleteButton'
import type { SelectOption } from '@/types'

export const metadata: Metadata = { title: 'Permission Slips | Teacher' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function TeacherPermissionSlipsPage() {
  const teacher = await requireTeacher()
  const adminClient = createSupabaseAdminClient()
  const resolved = await resolveTeacherClasses(adminClient, teacher.email)
  const classes = resolved?.classes ?? []
  const classOptions: SelectOption[] = classes.map((c) => ({ value: c.id, label: c.name }))

  const slips = teacher.schoolId
    ? await getTeacherSlips(
        teacher.schoolId,
        classes.map((c) => c.id),
      )
    : []

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Permission slips</h1>
        <p className="mt-1 text-sm text-text-muted">
          Ask your class&apos;s parents to grant or decline consent, then track responses.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
          You have no class assigned yet, so you can&apos;t create permission slips.
        </p>
      ) : (
        <>
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold text-text-primary">New permission slip</h2>
            <PermissionSlipForm classes={classOptions} allowSchool={false} />
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
                          href={`/teacher/permission-slips/${s.id}`}
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
        </>
      )}
    </div>
  )
}
