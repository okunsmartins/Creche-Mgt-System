#!/usr/bin/env node
// READ-ONLY check for migration 112: is every table in `public` protected by the
// two-step sign-in rule (RLS on + the restrictive `mfa_required` policy)?
//
//   node scripts/verify-mfa-policies.mjs            # uses .env.local
//   node scripts/verify-mfa-policies.mjs path/to/.env
//
// Calls public.mfa_policy_gaps() with the service-role key (it only reads the catalog).
// Expected: "0 gaps". Exit code 1 if any table is unprotected or 112 isn't applied.

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
process.exit(gaps.length === 0 ? 0 : 1)
