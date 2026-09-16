'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  /** Prevents closing by clicking the backdrop */
  disableBackdropClose?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  disableBackdropClose = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [open])

  // Sync state when dialog is closed via Escape key
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handler = () => onClose()
    dialog.addEventListener('close', handler)
    return () => dialog.removeEventListener('close', handler)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      className={cn(
        'w-full max-w-md rounded-lg border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50',
        'open:flex open:flex-col',
        className,
      )}
      onClick={(e) => {
        // Close when clicking the backdrop (outside the dialog box)
        if (!disableBackdropClose && e.target === e.currentTarget) onClose()
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h2 id="modal-title" className="text-base font-semibold text-text-primary">
            {title}
          </h2>
          {description && (
            <p id="modal-description" className="mt-0.5 text-sm text-text-muted">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          suppressHydrationWarning
          className="shrink-0 rounded p-1 text-text-muted hover:bg-gray-100 hover:text-text-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-4">{children}</div>
    </dialog>
  )
}
