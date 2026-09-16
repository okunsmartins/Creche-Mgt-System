'use client'

import { useActionState } from 'react'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { createTeacherLoginAction, type TeacherLoginState } from '@/lib/teachers/actions'

interface Props {
  teacherId: string
  hasLogin: boolean
  email: string | null
}

export function TeacherLoginPanel({ teacherId, hasLogin, email }: Props) {
  const action = createTeacherLoginAction.bind(null, teacherId)
  const [state, formAction, isPending] = useActionState<TeacherLoginState, FormData>(action, null)

  // Success — show the one-time credentials.
  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Login created
        </p>
        <p className="mt-2 text-xs text-text-secondary">
          Share these with the teacher securely — the password is shown <strong>once</strong>. They
          can change it after signing in.
        </p>
        <dl className="mt-3 space-y-1.5 rounded-lg bg-surface-raised p-3 font-mono text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Email</dt>
            <dd className="text-text-primary">{state.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-text-muted">Temp password</dt>
            <dd className="text-text-primary">{state.tempPassword}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-text-muted">They sign in at the staff login page.</p>
      </div>
    )
  }

  if (hasLogin) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> This teacher has a login
        </p>
        <p className="mt-1 text-xs text-text-muted">{email} can sign in to the teacher portal.</p>
      </div>
    )
  }

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-medium text-text-primary">Teacher login</p>
      <p className="mt-1 text-xs text-text-muted">
        {email
          ? 'Create a login so this teacher can sign in to take attendance.'
          : 'Add an email address to this teacher before creating a login.'}
      </p>
      {state?.error && (
        <Alert variant="error" className="mt-3 text-xs">
          {state.error}
        </Alert>
      )}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="mt-3"
        loading={isPending}
        disabled={!email}
      >
        <KeyRound className="mr-1.5 h-3.5 w-3.5" />
        Create login
      </Button>
    </form>
  )
}
