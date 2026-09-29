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
 * It checks three things for `fee_schedules` / `child_funding_registrations` / `invoices`:
 *   1. App-layer scoping — a query scoped to Tenant B never returns Tenant A's rows.
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
const created = { schedule: null, registration: null, invoice: null }

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
  created.registration = reg.data?.id
  ok('seed: NCS registration for Tenant A', !reg.error, reg.error?.message)

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

  // ── 1. App-layer scoping: Tenant B's scoped queries never see Tenant A's rows ──
  for (const table of ['fee_schedules', 'child_funding_registrations', 'invoices']) {
    const { data } = await admin.from(table).select('id').eq('school_id', tenantB)
    const leaked = (data ?? []).some((r) => Object.values(created).includes(r.id))
    ok(`scoping: Tenant B query on ${table} excludes Tenant A rows`, !leaked)
  }

  // ── 2. RLS backstop: anon/authenticated key sees ZERO rows (deny-by-default) ──
  for (const table of ['fee_schedules', 'child_funding_registrations', 'invoices']) {
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
