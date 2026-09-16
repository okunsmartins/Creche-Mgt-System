import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { sendDueSoonReminders } from '@/lib/permission-slips/reminders'

// Daily cron (see vercel.json). Emails a reminder to parents who still have a
// pending response on a permission slip due tomorrow. Authenticated with
// CRON_SECRET: Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`.
// Path is under /api/cron/ so the auth middleware skips it.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = serverEnv.cronSecret
  if (!secret) {
    logger.warn('cron_permission_slip_reminders_unconfigured')
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendDueSoonReminders(1)
    logger.info('cron_permission_slip_reminders_done', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('cron_permission_slip_reminders_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Reminder run failed' }, { status: 500 })
  }
}
