import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { getWeekRota } from '@/lib/rota/queries'
import { mondayOf, addDays } from '@/lib/rota/rota'
import { RotaBoard } from '@/components/rota/RotaBoard'

export const metadata: Metadata = { title: 'Rota | Admin' }
export const dynamic = 'force-dynamic'

export default async function RotaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const admin = await requireAdmin()
  if (!admin.schoolId)
    return <p className="text-error">No crèche is associated with your account.</p>

  const { week } = await searchParams
  const weekStart = mondayOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : new Date())
  const rota = await getWeekRota(admin.schoolId, weekStart)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Staff rota</h1>
        <p className="mt-1 text-sm text-text-muted">
          Plan the weekly rota — assign staff to shifts and rooms. Hours per staff are totalled for
          the week.
        </p>
      </div>
      <RotaBoard week={rota} prevWeek={addDays(weekStart, -7)} nextWeek={addDays(weekStart, 7)} />
    </div>
  )
}
