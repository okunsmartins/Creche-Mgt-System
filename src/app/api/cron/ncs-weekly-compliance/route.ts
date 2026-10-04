import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { buildWeeklyComplianceForEnabledTenants } from '@/lib/funding/service'

// Weekly cron (see vercel.json) — runs after the NCS reporting week closes. Builds
// the idempotent weekly compliance snapshots + prioritised action items for every
// tenant that has the Funding & Hive Centre enabled. Tenant-safe. Authenticated with
// CRON_SECRET (Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`); the
// path is under /api/cron/ so the auth middleware skips it.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = serverEnv.cronSecret
  if (!secret) {
    logger.warn('cron_ncs_weekly_compliance_unconfigured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await buildWeeklyComplianceForEnabledTenants()
    const actionsCreated = result.summaries.reduce((n, s) => n + s.actionsCreated, 0)
    logger.info('cron_ncs_weekly_compliance_done', {
      weekStart: result.weekStart,
      tenants: result.tenants,
      actionsCreated,
    })
    return NextResponse.json({
      ok: true,
      weekStart: result.weekStart,
      tenants: result.tenants,
      actionsCreated,
    })
  } catch (err) {
    logger.error('cron_ncs_weekly_compliance_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Compliance run failed' }, { status: 500 })
  }
}
