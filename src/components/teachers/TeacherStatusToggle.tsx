'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTeacherAction } from '@/lib/teachers/actions'

interface TeacherStatusToggleProps {
  teacherId: string
  currentStatus: boolean
  firstName: string
  lastName: string
  displayName: string | null
  email: string | null
}

export function TeacherStatusToggle({
  teacherId,
  currentStatus,
  firstName,
  lastName,
  displayName,
  email,
}: TeacherStatusToggleProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('firstName', firstName)
      formData.set('lastName', lastName)
      formData.set('displayName', displayName ?? '')
      formData.set('email', email ?? '')
      formData.set('isActive', currentStatus ? 'false' : 'true')
      await updateTeacherAction(teacherId, null, formData)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        currentStatus
          ? 'bg-green-100 text-green-800 hover:bg-green-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } disabled:opacity-50`}
      aria-label={`${currentStatus ? 'Deactivate' : 'Activate'} ${firstName} ${lastName}`}
    >
      {isPending ? '…' : currentStatus ? 'Active' : 'Inactive'}
    </button>
  )
}
