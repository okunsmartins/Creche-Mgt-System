import { Badge } from '@/components/ui/Badge'
import type { SlipDetail } from '@/lib/permission-slips/queries'

/** Shared tally + per-pupil response table for the admin and teacher slip detail. */
export function SlipResponsesTable({ tally, students }: Pick<SlipDetail, 'tally' | 'students'>) {
  return (
    <>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-success">
          {tally.granted} granted
        </span>
        <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-error">
          {tally.declined} declined
        </span>
        <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-text-muted ring-1 ring-border">
          {tally.pending} awaiting
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-surface text-xs font-semibold uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-4 py-3">Child</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Response</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((s) => (
              <tr key={s.studentId} className="bg-surface">
                <td className="px-4 py-3 font-medium text-text-primary">{s.name}</td>
                <td className="px-4 py-3 text-text-secondary">{s.className ?? '—'}</td>
                <td className="px-4 py-3">
                  {s.consent === null ? (
                    <Badge variant="warning">Awaiting</Badge>
                  ) : s.consent ? (
                    <Badge variant="success">Granted</Badge>
                  ) : (
                    <Badge variant="error">Declined</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">{s.note ? s.note : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
