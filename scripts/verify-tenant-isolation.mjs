#!/usr/bin/env node
/**
 * Cross-tenant isolation + idempotency verification for the fee/invoice tables.
 *
 * WHY THIS IS A SCRIPT, NOT A VITEST TEST: it needs a live Supabase database, and
 * CI has no DB credentials. Run it locally (or in a DB-enabled pipeline) against the
 * dev project. It exits non-zero on any failure so it can gate a deploy later.
 *
 *   node scripts/verify-tenant-isolation.mjs
 *
 * It checks, for `fee_schedules` / `child_funding_registrations` / `invoices` /
 * `authorised_collectors`:
 *   1. App-layer scoping — a query scoped to Tenant B never returns Tenant A's rows.
 *   1b. Action guard — a Tenant-B-scoped mutation can't modify Tenant A's collector
 *       (mirrors reviewCollectorAction's `.eq('id').eq('school_id')`).
 *   2. RLS backstop — the anon/authenticated key sees ZERO rows (deny-by-default),
 *      so a forgotten `school_id` filter still can't leak across tenants.
 *   3. Idempotency — a duplicate invoice_number is rejected by the unique constraint.
 *
 * Cleans up everything it creates.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !serviceKey || !anonKey) {
  console.error('Missing Supabase env (URL / service-role / anon).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const anon = createClient(url, anonKey, { auth: { persistSession: false } })

let failures = 0
const ok = (label, pass, detail = '') =>
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`) ||
  (pass ? 0 : (failures++, 0))

// Track created rows for cleanup.
const created = {
  schedule: null,
  registration: null,
  invoice: null,
  collector: null,
  collectionMethod: null,
  collectionRun: null,
  collectionEnrolment: null,
}

async function main() {
  // Two tenants. The dev DB has 2 schools; Tenant A must have at least one child.
  const { data: schools } = await admin.from('schools').select('id, name')
  if (!schools || schools.length < 2) {
    console.error(`Need >=2 schools to test isolation; found ${schools?.length ?? 0}.`)
    process.exit(1)
  }
  let tenantA = null
  let childA = null
  for (const s of schools) {
    const { data: kids } = await admin.from('students').select('id').eq('school_id', s.id).limit(1)
    if (kids && kids.length) {
      tenantA = s.id
      childA = kids[0].id
      break
    }
  }
  const tenantB = schools.find((s) => s.id !== tenantA)?.id
  if (!tenantA || !tenantB) {
    console.error('Could not pick Tenant A (with a child) and a distinct Tenant B.')
    process.exit(1)
  }
  console.log(`Tenant A = ${tenantA} (child ${childA})`)
  console.log(`Tenant B = ${tenantB}\n`)

  // ── Seed Tenant A ──────────────────────────────────────────────────────────
  const sched = await admin
    .from('fee_schedules')
    .insert({
      school_id: tenantA,
      student_id: childA,
      name: 'ISO-TEST',
      frequency: 'weekly',
      provider_hourly_rate_cents: 600,
      contracted_day_hours: [8, 8, 8, 8, 8],
      start_date: '2026-09-01',
      end_date: '2026-09-28',
    })
    .select('id')
    .single()
  created.schedule = sched.data?.id
  ok('seed: fee_schedule for Tenant A', !sched.error, sched.error?.message)

  // The child may already have an ACTIVE NCS registration (the "one active per scheme
  // per child" partial-unique). That's fine — for the scoping test we just need a
  // Tenant A registration row, so on collision we reuse the existing one and don't
  // delete it in cleanup (we didn't create it).
  const reg = await admin
    .from('child_funding_registrations')
    .insert({
      school_id: tenantA,
      student_id: childA,
      scheme: 'NCS',
      status: 'ACTIVE',
      awarded_hourly_rate_cents: 214,
      awarded_weekly_hours: 45,
    })
    .select('id')
    .single()
  let registrationId = reg.data?.id ?? null
  if (reg.error) {
    const existing = await admin
      .from('child_funding_registrations')
      .select('id')
      .eq('school_id', tenantA)
      .limit(1)
      .maybeSingle()
    registrationId = existing.data?.id ?? null
    ok('seed: NCS registration for Tenant A (reused existing row)', !!registrationId)
  } else {
    created.registration = reg.data.id // only clean up what we created
    ok('seed: NCS registration for Tenant A', true)
  }

  const num = (await admin.rpc('generate_invoice_number')).data
  const inv = await admin
    .from('invoices')
    .insert({
      school_id: tenantA,
      student_id: childA,
      fee_schedule_id: created.schedule,
      invoice_number: num,
      period_start: '2026-09-01',
      period_end: '2026-09-07',
      due_date: '2026-09-01',
      gross_parent_cents: 24000,
      ncs_subsidy_cents: 8560,
      net_parent_cents: 15440,
      status: 'issued',
      issued_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  created.invoice = inv.data?.id
  ok('seed: issued invoice for Tenant A', !inv.error, inv.error?.message)

  const col = await admin
    .from('authorised_collectors')
    .insert({
      school_id: tenantA,
      student_id: childA,
      full_name: 'ISO-TEST Collector',
      relationship: 'grandparent',
      status: 'approved',
      proposed_by: 'staff',
    })
    .select('id')
    .single()
  created.collector = col.data?.id
  ok('seed: authorised collector for Tenant A', !col.error, col.error?.message)

  const meth = await admin
    .from('collection_methods')
    .insert({ school_id: tenantA, label: 'ISO-TEST Minibus' })
    .select('id')
    .single()
  created.collectionMethod = meth.data?.id
  ok('seed: collection method for Tenant A', !meth.error, meth.error?.message)

  const crun = await admin
    .from('collection_runs')
    .insert({
      school_id: tenantA,
      name: 'ISO-TEST Run',
      origin_school_name: 'ISO-TEST NS',
      collection_method_id: created.collectionMethod,
      days_of_week: [1, 2, 3],
      capacity: 8,
      charge_basis: 'per_day',
      price_cents: 1200,
    })
    .select('id')
    .single()
  created.collectionRun = crun.data?.id
  ok('seed: collection run for Tenant A', !crun.error, crun.error?.message)

  const cenr = await admin
    .from('collection_enrolments')
    .insert({
      school_id: tenantA,
      student_id: childA,
      collection_run_id: created.collectionRun,
      status: 'approved',
      requested_by: 'staff',
    })
    .select('id')
    .single()
  created.collectionEnrolment = cenr.data?.id
  ok('seed: collection enrolment for Tenant A', !cenr.error, cenr.error?.message)

  // ── 1. App-layer scoping: Tenant B's scoped queries never see Tenant A's rows ──
  // Known Tenant A ids (created or reused) that must never appear in a Tenant B query.
  const tenantAIds = [
    created.schedule,
    registrationId,
    created.invoice,
    created.collector,
    created.collectionMethod,
    created.collectionRun,
    created.collectionEnrolment,
  ]
  for (const table of [
    'fee_schedules',
    'child_funding_registrations',
    'invoices',
    'authorised_collectors',
    'collection_methods',
    'collection_runs',
    'collection_enrolments',
  ]) {
    const { data } = await admin.from(table).select('id').eq('school_id', tenantB)
    const leaked = (data ?? []).some((r) => tenantAIds.includes(r.id))
    ok(`scoping: Tenant B query on ${table} excludes Tenant A rows`, !leaked)
  }

  // ── 1b. Action guard: a Tenant-B-scoped mutation can't touch Tenant A's collector ──
  // Mirrors reviewCollectorAction's `.eq('id', id).eq('school_id', <my school>)` — an
  // admin of Tenant B must change ZERO rows when aiming at Tenant A's collector.
  {
    const { data: touched } = await admin
      .from('authorised_collectors')
      .update({ status: 'revoked', is_active: false })
      .eq('id', created.collector)
      .eq('school_id', tenantB)
      .select('id')
    ok('cross-tenant: Tenant B cannot revoke Tenant A collector', (touched?.length ?? 0) === 0)
    // Confirm the row is untouched (still approved/active).
    const { data: still } = await admin
      .from('authorised_collectors')
      .select('status, is_active')
      .eq('id', created.collector)
      .single()
    ok(
      'cross-tenant: Tenant A collector left intact',
      still?.status === 'approved' && still?.is_active === true,
      `status=${still?.status} active=${still?.is_active}`,
    )
  }

  // ── 1c. Action guard: a Tenant-B-scoped mutation can't touch Tenant A's run ──
  // Mirrors deleteCollectionRunAction / setRunStaffAction `.eq('school_id', <my school>)`.
  {
    const { data: touched } = await admin
      .from('collection_runs')
      .update({ is_active: false, name: 'HIJACKED' })
      .eq('id', created.collectionRun)
      .eq('school_id', tenantB)
      .select('id')
    ok('cross-tenant: Tenant B cannot modify Tenant A run', (touched?.length ?? 0) === 0)
    const { data: still } = await admin
      .from('collection_runs')
      .select('name, is_active')
      .eq('id', created.collectionRun)
      .single()
    ok(
      'cross-tenant: Tenant A run left intact',
      still?.name === 'ISO-TEST Run' && still?.is_active === true,
      `name=${still?.name} active=${still?.is_active}`,
    )
  }

  // ── 1d. Action guard: Tenant B can't touch Tenant A's collection enrolment ──
  // Mirrors reviewEnrolmentAction `.eq('id', id).eq('school_id', <my school>)`.
  {
    const { data: touched } = await admin
      .from('collection_enrolments')
      .update({ status: 'ended' })
      .eq('id', created.collectionEnrolment)
      .eq('school_id', tenantB)
      .select('id')
    ok('cross-tenant: Tenant B cannot end Tenant A enrolment', (touched?.length ?? 0) === 0)
    const { data: still } = await admin
      .from('collection_enrolments')
      .select('status')
      .eq('id', created.collectionEnrolment)
      .single()
    ok(
      'cross-tenant: Tenant A enrolment left intact',
      still?.status === 'approved',
      `status=${still?.status}`,
    )
  }

  // ── 2. RLS backstop: anon/authenticated key sees ZERO rows (deny-by-default) ──
  for (const table of [
    'fee_schedules',
    'child_funding_registrations',
    'invoices',
    'authorised_collectors',
    'collection_methods',
    'collection_runs',
    'collection_enrolments',
  ]) {
    const { data, error } = await anon.from(table).select('id').limit(5)
    const blocked = !!error || (data ?? []).length === 0
    ok(
      `RLS: anon key sees no rows in ${table}`,
      blocked,
      error ? error.message : `${data?.length ?? 0} rows`,
    )
  }

  // ── 3. Idempotency: duplicate invoice_number rejected by unique constraint ────
  const dup = await admin.from('invoices').insert({
    school_id: tenantA,
    student_id: childA,
    invoice_number: num, // same number
    period_start: '2026-09-01',
    period_end: '2026-09-07',
    due_date: '2026-09-01',
    net_parent_cents: 15440,
    status: 'draft',
  })
  ok(
    'idempotency: duplicate invoice_number rejected',
    !!dup.error,
    dup.error ? 'rejected' : 'ALLOWED (!)',
  )

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  if (created.collectionEnrolment)
    await admin.from('collection_enrolments').delete().eq('id', created.collectionEnrolment)
  if (created.collectionRun)
    await admin.from('collection_runs').delete().eq('id', created.collectionRun)
  if (created.collectionMethod)
    await admin.from('collection_methods').delete().eq('id', created.collectionMethod)
  if (created.collector)
    await admin.from('authorised_collectors').delete().eq('id', created.collector)
  if (created.invoice) await admin.from('invoices').delete().eq('id', created.invoice)
  if (created.registration)
    await admin.from('child_funding_registrations').delete().eq('id', created.registration)
  if (created.schedule) await admin.from('fee_schedules').delete().eq('id', created.schedule)
  console.log('\ncleanup: done')

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
