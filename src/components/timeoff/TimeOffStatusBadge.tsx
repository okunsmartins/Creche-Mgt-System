import { Badge } from '@/components/ui/Badge'
import type { TimeOffStatus } from '@/types/database'

const STATUS: Record<TimeOffStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
}

export function TimeOffStatusBadge({ status }: { status: TimeOffStatus }) {
  const s = STATUS[status]
  return <Badge variant={s.variant}>{s.label}</Badge>
}
