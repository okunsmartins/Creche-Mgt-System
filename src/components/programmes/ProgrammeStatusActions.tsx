'use client'

import { useRef, useState } from 'react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  publishProgrammeAction,
  closeProgrammeAction,
  archiveProgrammeAction,
} from '@/lib/programmes/actions'
import type { ProgrammeActionState } from '@/lib/programmes/schemas'
import type { PublicationStatus } from '@/types/database'

interface ProgrammeStatusActionsProps {
  programmeId: string
  currentStatus: PublicationStatus
}

export function ProgrammeStatusActions({
  programmeId,
  currentStatus,
}: ProgrammeStatusActionsProps) {
  const archiveFormRef = useRef<HTMLFormElement>(null)
  const closeFormRef = useRef<HTMLFormElement>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const [publishState, publishFormAction, isPublishing] = useActionState<
    ProgrammeActionState,
    FormData
  >(publishProgrammeAction, null)

  const [closeState, closeFormAction, isClosing] = useActionState<ProgrammeActionState, FormData>(
    closeProgrammeAction,
    null,
  )

  const [archiveState, archiveFormAction, isArchiving] = useActionState<
    ProgrammeActionState,
    FormData
  >(archiveProgrammeAction, null)

  if (currentStatus === 'archived') {
    return (
      <p className="text-sm text-text-muted">
        This programme is archived and its status cannot be changed.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {publishState?.error && <Alert variant="error">{publishState.error}</Alert>}
      {publishState?.success && <Alert variant="success">{publishState.message}</Alert>}
      {closeState?.error && <Alert variant="error">{closeState.error}</Alert>}
      {closeState?.success && <Alert variant="success">{closeState.message}</Alert>}
      {archiveState?.error && <Alert variant="error">{archiveState.error}</Alert>}
      {archiveState?.success && <Alert variant="success">{archiveState.message}</Alert>}

      <div className="flex flex-wrap gap-3">
        {/* draft → published */}
        {currentStatus === 'draft' && !publishState?.success && (
          <form action={publishFormAction}>
            <input type="hidden" name="programmeId" value={programmeId} />
            <Button type="submit" loading={isPublishing}>
              Publish
            </Button>
          </form>
        )}

        {/* published → closed */}
        {currentStatus === 'published' && !closeState?.success && (
          <form ref={closeFormRef} action={closeFormAction}>
            <input type="hidden" name="programmeId" value={programmeId} />
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCloseConfirm(true)}
              disabled={isClosing}
            >
              Close
            </Button>
          </form>
        )}

        {/* closed → published (reopen) */}
        {currentStatus === 'closed' && !publishState?.success && (
          <form action={publishFormAction}>
            <input type="hidden" name="programmeId" value={programmeId} />
            <Button type="submit" loading={isPublishing}>
              Re-publish
            </Button>
          </form>
        )}

        {/* any non-archived → archived */}
        {!archiveState?.success && (
          <form ref={archiveFormRef} action={archiveFormAction}>
            <input type="hidden" name="programmeId" value={programmeId} />
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowArchiveConfirm(true)}
              disabled={isArchiving}
            >
              Archive
            </Button>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={() => {
          setShowCloseConfirm(false)
          closeFormRef.current?.requestSubmit()
        }}
        title="Close programme"
        description="Closing will hide this programme from parents and stop new enrolments. You can re-publish it later."
        confirmLabel="Close"
        variant="danger"
      />

      <ConfirmDialog
        open={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={() => {
          setShowArchiveConfirm(false)
          archiveFormRef.current?.requestSubmit()
        }}
        title="Archive programme"
        description="Archiving will permanently hide this programme from parents and prevent new enrolments. This cannot be undone."
        confirmLabel="Archive"
        variant="danger"
      />
    </div>
  )
}
