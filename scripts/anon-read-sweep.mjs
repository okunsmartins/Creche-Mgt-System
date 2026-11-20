#!/usr/bin/env node
// READ-ONLY security check: which tables can the public (anon) key read rows from?
// Lists every table PostgREST exposes, then tries one anon SELECT on each.
//
//   node scripts/anon-read-sweep.mjs            # uses .env.local
//   node scripts/anon-read-sweep.mjs path/to/.env
//
// Expected: only `activities` (published activities are public on purpose).
// Exit code 1 if anything else is readable.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_PUBLIC = new Set(['activities'])

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
const service = env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !service || !anonKey) {
  console.error(
    'Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY',
  )
  process.exit(2)
}

const spec = await (
  await fetch(`${url}/rest/v1/`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  })
).json()
const tables = Object.keys(spec.paths ?? {})
  .filter((p) => p !== '/' && !p.startsWith('/rpc/'))
  .map((p) => p.slice(1))
  .sort()

const anon = createClient(url, anonKey)
const readable = []
for (const t of tables) {
  const { data, error } = await anon.from(t).select('*').limit(1)
  if (!error && (data?.length ?? 0) > 0) readable.push(t)
}

const unexpected = readable.filter((t) => !ALLOWED_PUBLIC.has(t))
console.log(`Tables checked: ${tables.length}`)
console.log(`Anon can read rows from: ${readable.length ? readable.join(', ') : 'none'}`)
if (unexpected.length) {
  console.error(`UNEXPECTED public tables: ${unexpected.join(', ')}`)
  process.exit(1)
}
console.log('OK: nothing unexpected is publicly readable.')
