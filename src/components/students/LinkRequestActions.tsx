'use client'

import { useState, useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { approveLinkRequestAction, rejectLinkRequestAction } from '@/lib/students/actions'
import type { StudentActionState } from '@/lib/students/schemas'

interface LinkRequestActionsProps {
  requestId: string
}

export function LinkRequestActions({ requestId }: LinkRequestActionsProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)

  const [approveState, approveFormAction, approvePending] = useActionState<
    StudentActionState,
    FormData
  >(approveLinkRequestAction, null)

  const [rejectState, rejectFormAction, rejectPending] = useActionState<
    StudentActionState,
    FormData
  >(rejectLinkRequestAction, null)

  if (approveState?.success || rejectState?.success) {
    return (
      <Alert variant="success" className="py-1 text-xs">
        {approveState?.message ?? rejectState?.message}
      </Alert>
    )
  }

  if (showRejectForm) {
    return (
      <form action={rejectFormAction} className="space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <textarea
          name="rejectionReason"
          placeholder="Reason for rejection…"
          rows={2}
          required
          maxLength={500}
          className="input-base w-full resize-none text-sm"
          disabled={rejectPending}
        />
        {rejectState?.fieldErrors?.rejectionReason && (
          <p className="text-xs text-error">{rejectState.fieldErrors.rejectionReason}</p>
        )}
        {rejectState?.error && <p className="text-xs text-error">{rejectState.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="danger" size="sm" loading={rejectPending}>
            Confirm rejection
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowRejectForm(false)}
            disabled={rejectPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex gap-2">
      <form action={approveFormAction}>
        <input type="hidden" name="requestId" value={requestId} />
        {approveState?.error && <p className="mb-1 text-xs text-error">{approveState.error}</p>}
        <Button type="submit" size="sm" loading={approvePending} disabled={rejectPending}>
          Approve
        </Button>
      </form>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowRejectForm(true)}
        disabled={approvePending}
      >
        Reject
      </Button>
    </div>
  )
}
