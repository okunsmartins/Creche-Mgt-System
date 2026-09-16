import type { ReactNode } from 'react'
import { FileText, ExternalLink, ImageIcon } from 'lucide-react'
import { formatFileSize } from '@/lib/assignments/validate'
import type { DocumentView } from '@/lib/documents/queries'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** One document row (icon, title/term, date/size, signed View link, optional action). */
export function DocumentFileRow({ doc, action }: { doc: DocumentView; action?: ReactNode }) {
  const primary = doc.title || doc.term || doc.originalFilename || 'Document'
  return (
    <li className="flex items-center gap-3 bg-surface px-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-raised">
        {doc.fileKind === 'image' ? (
          <ImageIcon className="h-5 w-5 text-text-muted" aria-hidden="true" />
        ) : (
          <FileText className="h-5 w-5 text-text-muted" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{primary}</p>
        <p className="text-xs text-text-muted">
          {doc.term && doc.title ? `${doc.term} · ` : ''}
          {formatDate(doc.createdAt)} · {formatFileSize(doc.fileSizeBytes)}
        </p>
      </div>
      {doc.url && (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          View
        </a>
      )}
      {action}
    </li>
  )
}
