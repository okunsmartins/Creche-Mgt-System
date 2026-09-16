'use client'

import { useActionState } from 'react'
import { changeUserRoleAction } from '@/lib/users/actions'
import type { UserRole } from '@/types/database'

interface RoleOption {
  name: UserRole
  displayName: string
}

interface Props {
  targetUserId: string
  currentRole: UserRole | null
  roles: RoleOption[]
}

const INITIAL: { error?: string; success?: boolean } = {}

export function ChangeRoleForm({ targetUserId, currentRole, roles }: Props) {
  const boundAction = changeUserRoleAction.bind(null, targetUserId)
  const [state, formAction, pending] = useActionState(boundAction, INITIAL)

  if (state.success) {
    return <span className="text-xs font-medium text-success">Role updated ✓</span>
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="roleName"
        defaultValue={currentRole ?? ''}
        disabled={pending}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        {roles.map((r) => (
          <option key={r.name} value={r.name}>
            {r.displayName}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state.error && <span className="text-xs text-error">{state.error}</span>}
    </form>
  )
}
