import { formatDate } from '@/lib/utils'

export interface MessageHistoryItem {
  id: string
  subject: string
  audienceLabel: string
  recipientCount: number
  createdAt: string
  senderName?: string | undefined
}

export function MessageHistory({ items }: { items: MessageHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-text-muted">
        No messages sent yet.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {items.map((m) => (
        <li
          key={m.id}
          className="flex flex-wrap items-start justify-between gap-2 bg-surface px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{m.subject}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {m.audienceLabel}
              {m.senderName ? ` · ${m.senderName}` : ''} · {formatDate(m.createdAt)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {m.recipientCount} sent
          </span>
        </li>
      ))}
    </ul>
  )
}
