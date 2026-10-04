import type { Metadata } from 'next'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { getParentChildrenObservations } from '@/lib/observations/queries'
import { ObservationTimeline } from '@/components/observations/ObservationTimeline'

export const metadata: Metadata = { title: 'Learning Journal' }

export default async function ParentLearningJournalPage() {
  const parent = await requireVerifiedAuth()
  const students = await getParentChildrenObservations(parent.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-1 text-2xl font-bold text-text-primary">Learning journal</h1>
      <p className="mb-6 text-sm text-text-muted">
        Observations your crèche has shared about your child&apos;s learning and development.
      </p>

      {students.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-text-muted">
          No children are linked to your account yet. Link a child under{' '}
          <span className="font-medium">My Children</span> first.
        </div>
      ) : (
        <ObservationTimeline
          students={students}
          emptyText="No observations have been shared yet. Check back soon."
        />
      )}
    </div>
  )
}
