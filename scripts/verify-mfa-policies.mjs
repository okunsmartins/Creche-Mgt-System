#!/usr/bin/env node
// READ-ONLY check for migration 112: is every table in `public` protected by the
// two-step sign-in rule (RLS on + the restrictive `mfa_required` policy)?
//
//   node scripts/verify-mfa-policies.mjs            # uses .env.local
//   node scripts/verify-mfa-policies.mjs path/to/.env
//
// 1. Calls public.mfa_policy_gaps() with the service-role key (it only reads the catalog).
//    Expected: "0 gaps".
// 2. Checks the public anon key can't call the MFA functions (migration 113).
//    Expected: "anon blocked: mfa_satisfied, mfa_policy_gaps, ensure_mfa_policy,
//    get_user_permissions" (the last one from migration 114).
// Exit code 1 if anything is wrong. Sets process.exitCode instead of calling
// process.exit(), which crashes Node on Windows while network handles are closing.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envFile = process.argv[2] ?? '.env.local'
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ''),
      ]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in', envFile)
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const { data, error } = await db.rpc('mfa_policy_gaps')
if (error) {
  console.error(
    'Could not run mfa_policy_gaps():',
    error.message,
    '\nIs migration 112 applied to this project?',
  )
  process.exit(1)
}
const gaps = data ?? []
console.log(`${gaps.length} gaps`)
for (const g of gaps) console.log(` - ${g.table_name}: ${g.reason}`)
let ok = gaps.length === 0

// Anyone on the internet has the anon key. A 401/403 "permission denied" is what we want.
// ensure_mfa_policy gets a table name that doesn't exist, so even a wrongly-allowed call
// would change nothing.
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!anon) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY: anon check skipped')
  ok = false
} else {
  const blocked = []
  const open = []
  for (const [fn, body] of [
    ['mfa_satisfied', {}],
    ['mfa_policy_gaps', {}],
    ['ensure_mfa_policy', { p_table: 'zz_verify_does_not_exist' }],
    // Migration 114: permission lookups only by the server or the user themselves.
    [
      'get_user_permissions',
      {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_school_id: '00000000-0000-0000-0000-000000000000',
      },
    ],
  ]) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if ((res.status === 401 || res.status === 403) && text.includes('42501')) blocked.push(fn)
    else open.push(`${fn} (HTTP ${res.status})`)
  }
  if (blocked.length) console.log(`anon blocked: ${blocked.join(', ')}`)
  if (open.length) {
    console.log(`anon CAN call: ${open.join(', ')}  (are migrations 113 and 114 applied?)`)
    ok = false
  }
}
process.exitCode = ok ? 0 : 1
