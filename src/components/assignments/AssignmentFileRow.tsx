import { FileText, ExternalLink, ImageIcon } from 'lucide-react'
import { formatFileSize } from '@/lib/assignments/validate'
import type { AssignmentView } from '@/lib/assignments/sort'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** One read-only assignment file row (icon, title, date/size, signed View link). */
export function AssignmentFileRow({ assignment: a }: { assignment: AssignmentView }) {
  return (
    <li className="flex items-center gap-3 bg-surface px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-raised">
        {a.fileKind === 'image' ? (
          <ImageIcon className="h-5 w-5 text-text-muted" aria-hidden="true" />
        ) : (
          <FileText className="h-5 w-5 text-text-muted" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {a.title || a.originalFilename || 'Assignment'}
        </p>
        <p className="text-xs text-text-muted">
          {formatDate(a.createdAt)} · {formatFileSize(a.fileSizeBytes)}
        </p>
      </div>
      {a.url && (
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          View
        </a>
      )}
    </li>
  )
}
