import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth/guards'
import { getWeekRota } from '@/lib/rota/queries'
import { getWeekCoverAlerts } from '@/lib/rota/cover-queries'
import { mondayOf, addDays } from '@/lib/rota/rota'
import { RotaBoard } from '@/components/rota/RotaBoard'
import { CoverAlertsPanel } from '@/components/rota/CoverAlertsPanel'

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
  const [rota, cover] = await Promise.all([
    getWeekRota(admin.schoolId, weekStart),
    getWeekCoverAlerts(admin.schoolId, weekStart),
  ])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Staff rota</h1>
        <p className="mt-1 text-sm text-text-muted">
          Plan the weekly rota — assign staff to shifts and rooms. Hours per staff are totalled for
          the week.
        </p>
      </div>
      <CoverAlertsPanel cover={cover} />
      <RotaBoard week={rota} prevWeek={addDays(weekStart, -7)} nextWeek={addDays(weekStart, 7)} />
    </div>
  )
}
