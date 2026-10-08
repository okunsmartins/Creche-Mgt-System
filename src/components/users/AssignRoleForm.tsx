'use client'

import { useActionState } from 'react'
import { assignRoleByEmailAction } from '@/lib/users/actions'
import type { UserRole } from '@/types/database'

interface RoleOption {
  name: UserRole
  displayName: string
}

const INITIAL: { error?: string; success?: boolean } = {}

/**
 * Assign a role to a staff member by their registered email — including users who have no
 * role yet (and so don't appear in the list above).
 */
export function AssignRoleForm({ roles }: { roles: RoleOption[] }) {
  const [state, formAction, pending] = useActionState(assignRoleByEmailAction, INITIAL)

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text-primary">Assign a role to staff</h2>
      <p className="mt-0.5 text-xs text-text-muted">
        Grant a registered staff member their role (e.g. teacher). They must have signed up first.
      </p>
      {state.success && <p className="mt-2 text-xs font-medium text-success">Role assigned ✓</p>}
      {state.error && <p className="mt-2 text-xs text-error">{state.error}</p>}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-xs">
          <span className="text-text-secondary">Staff email</span>
          <input
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            disabled={pending}
            className="input-base mt-1 w-64"
            autoComplete="off"
          />
        </label>
        <label className="block text-xs">
          <span className="text-text-secondary">Role</span>
          <select
            name="roleName"
            disabled={pending}
            defaultValue="teacher"
            className="input-base mt-1"
          >
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {r.displayName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Assigning…' : 'Assign role'}
        </button>
      </div>
    </form>
  )
}
