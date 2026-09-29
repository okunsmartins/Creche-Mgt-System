import 'server-only'
import { NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { provisionSchool, validateSubdomain } from '@/lib/tenant/provision'

/**
 * DEV-ONLY tenant seeder. Provisions a crèche (school + settings + default rooms +
 * owner membership) via the real provisionSchool path, then dev-unlocks Pro so the
 * admin portal and Pro features (csv_import) are reachable without Stripe/email.
 *
 * Guarded: refuses unless APP_ENV != 'production' AND the x-dev-secret header
 * matches CRON_SECRET. Remove this route before any production deploy.
 *
 * GET /api/dev/seed-tenant?name=...&subdomain=...&email=...
 *   header: x-dev-secret: <CRON_SECRET>
 */
export async function GET(req: Request): Promise<Response> {
  if (serverEnv.appEnv === 'production') {
    return NextResponse.json({ error: 'disabled in production' }, { status: 404 })
  }
  const secret = req.headers.get('x-dev-secret') ?? ''
  if (!serverEnv.cronSecret || secret !== serverEnv.cronSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const name = (url.searchParams.get('name') ?? 'Angels Nest Crèche').trim()
  const subdomainRaw = url.searchParams.get('subdomain') ?? 'angelsnest'
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const sub = validateSubdomain(subdomainRaw)
  if (!sub.ok) return NextResponse.json({ error: sub.error }, { status: 400 })

  const admin = createSupabaseAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json(
      { error: `no profile for ${email} — sign in once first` },
      { status: 404 },
    )
  }

  const result = await provisionSchool(admin, {
    name,
    subdomain: sub.value,
    ownerProfileId: profile.id as string,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 })
  }

  // Dev-unlock Pro (30-day trialing) so admin + csv_import are reachable.
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { error: subErr } = await admin
    .from('subscriptions')
    .update({
      plan: 'pro',
      status: 'trialing',
      trial_ends_at: future,
      current_period_end: future,
      updated_at: new Date().toISOString(),
    })
    .eq('school_id', result.schoolId)

  return NextResponse.json({
    ok: true,
    schoolId: result.schoolId,
    subdomain: sub.value,
    ownerProfileId: profile.id,
    proUnlock: subErr ? `failed: ${subErr.message}` : 'pro/trialing',
  })
}
