import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Audit Log' }

const ACTION_LABEL: Record<string, string> = {
  'refund.requested': 'Refund requested',
  'refund.completed': 'Refund completed',
  'refund.failed': 'Refund failed',
  'reconciliation.resolved': 'Reconciliation resolved',
  'report.exported': 'Report exported',
  'order.created': 'Order created',
  'order.paid': 'Order paid',
  'email.sent': 'Email sent',
  'email.resent': 'Email resent',
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }>
}) {
  const admin = await requireAdmin()
  const { action = '', from = '', to = '', page: pageStr = '1' } = await searchParams
  const page = Math.max(1, parseInt(pageStr, 10) || 1)
  const perPage = 50
  const offset = (page - 1) * perPage

  const adminClient = createSupabaseAdminClient()

  type AuditLog = {
    id: string
    action: string
    resource_type: string | null
    resource_id: string | null
    actor_email: string | null
    metadata: Record<string, unknown> | null
    ip_address: string | null
    created_at: string
    correlation_id: string | null
  }

  let query = adminClient
    .from('audit_logs')
    .select(
      'id, action, resource_type, resource_id, actor_email, metadata, ip_address, created_at, correlation_id',
      { count: 'exact' },
    )
    .eq('school_id', admin.schoolId!)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (action) query = query.eq('action', action)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', `${to}T23:59:59Z`)

  const { data, count } = await query
  const logs = (data as unknown as AuditLog[]) ?? []
  const totalPages = Math.ceil((count ?? 0) / perPage)

  const allActions = [
    'refund.requested',
    'refund.completed',
    'refund.failed',
    'reconciliation.resolved',
    'report.exported',
    'order.created',
    'order.paid',
    'email.sent',
    'email.resent',
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-text-primary">Audit Log</h1>

      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="action"
          defaultValue={action}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">All actions</option>
          {allActions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a] ?? a}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
          suppressHydrationWarning
        />
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
          suppressHydrationWarning
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          Filter
        </button>
        <a
          href="/admin/audit"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface"
        >
          Clear
        </a>
      </form>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-12 text-center">
          <p className="text-sm text-text-muted">No audit log entries found.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            Showing {offset + 1}–{Math.min(offset + perPage, count ?? 0)} of {count ?? 0} entries
          </p>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium text-text-primary">
                      {ACTION_LABEL[log.action] ?? log.action}
                    </p>
                    <p className="text-xs text-text-muted">
                      {log.actor_email ?? 'System'}
                      {log.resource_type && (
                        <>
                          {' · '}
                          <span className="font-mono">{log.resource_type}</span>
                          {log.resource_id && (
                            <span className="font-mono text-text-muted">:{log.resource_id}</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <time
                    dateTime={log.created_at}
                    className="shrink-0 text-xs text-text-muted"
                    title={log.created_at}
                  >
                    {formatDate(log.created_at, true)}
                  </time>
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-text-muted hover:text-text-primary">
                      Metadata
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-surface-raised p-2 text-xs text-text-secondary">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              {page > 1 ? (
                <a
                  href={`?${new URLSearchParams({ ...(action ? { action } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page: String(page - 1) })}`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface"
                >
                  Previous
                </a>
              ) : (
                <span />
              )}
              <p className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </p>
              {page < totalPages ? (
                <a
                  href={`?${new URLSearchParams({ ...(action ? { action } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page: String(page + 1) })}`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface"
                >
                  Next
                </a>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
