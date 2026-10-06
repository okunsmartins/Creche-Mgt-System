import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { runFundingScansForEnabledTenants } from '@/lib/funding/scans-service'

// Daily cron (see vercel.json) — the time-based proactive scans: NCS award/CHICK
// expiry and Programme Readiness drift. Raises deduped hive_action_items per tenant.
// Tenant-safe + idempotent. Authenticated with CRON_SECRET (Bearer); the path is under
// /api/cron/ so the auth middleware skips it.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = serverEnv.cronSecret
  if (!secret) {
    logger.warn('cron_funding_scans_unconfigured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runFundingScansForEnabledTenants()
    const awardActions = result.summaries.reduce((n, s) => n + s.awardActions, 0)
    const readinessActions = result.summaries.reduce((n, s) => n + s.readinessActions, 0)
    logger.info('cron_funding_scans_done', {
      tenants: result.tenants,
      awardActions,
      readinessActions,
    })
    return NextResponse.json({ ok: true, tenants: result.tenants, awardActions, readinessActions })
  } catch (err) {
    logger.error('cron_funding_scans_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Scan run failed' }, { status: 500 })
  }
}
