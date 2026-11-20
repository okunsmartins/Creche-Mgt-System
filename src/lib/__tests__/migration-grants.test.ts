// @vitest-environment node
//
// Guards Supabase table access in migrations (runs in CI with the unit tests).
//
// Since 30 Oct 2026 Supabase gives NEW tables in `public` no API access until the
// creating migration grants it, so a table without a grant silently breaks the app
// ("permission denied"). And granting to `anon` makes a table readable by anyone on the
// internet, which is how three inherited tables leaked until migration 110.
//
// Rules:
//  1. Every table created in the migrations has a GRANT … TO service_role somewhere.
//  2. From migration STRICT_FROM on, that grant must be in the SAME migration file.
//  3. From migration STRICT_FROM on, any GRANT … TO anon must be marked deliberate with
//     a `-- public-on-purpose` comment on the same line.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations')
/** First migration number the stricter rules (2, 3) apply to. */
const STRICT_FROM = 111
const PUBLIC_MARK = 'public-on-purpose'

interface Migration {
  name: string
  number: number
  sql: string
}

/** Remove SQL comments (block and line) so commented-out statements don't count. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')
}

/** Table names created in a migration (public schema or unqualified). */
export function createdTables(sql: string): string[] {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi
  return [...stripSqlComments(sql).matchAll(re)].map((m) => m[1]!.toLowerCase())
}

/** Tables that get a GRANT … TO <role> in this SQL. */
export function tablesGrantedTo(sql: string, role: string): Set<string> {
  const out = new Set<string>()
  const re = /grant\s+[^;]*?\bon\s+(?:table\s+)?([^;]*?)\s+to\s+([^;]*);/gi
  for (const m of stripSqlComments(sql).matchAll(re)) {
    const roles = m[2]!.toLowerCase().split(/[\s,]+/)
    if (!roles.includes(role)) continue
    for (const t of m[1]!.split(',')) {
      const name = t
        .trim()
        .replace(/^public\./i, '')
        .replace(/"/g, '')
        .toLowerCase()
      if (name) out.add(name)
    }
  }
  return out
}

/** `GRANT … TO anon` lines not marked as deliberately public. */
export function unmarkedAnonGrants(sql: string): string[] {
  // Statement-level check on comment-free SQL, then look for the marker on the raw line.
  const rawLines = sql.split('\n')
  const hits: string[] = []
  for (const line of rawLines) {
    const code = line.replace(/--.*$/, '')
    if (/\bgrant\b/i.test(code) && /\bto\b[^;]*\banon\b/i.test(code) && !line.includes(PUBLIC_MARK))
      hits.push(line.trim())
  }
  return hits
}

function loadMigrations(): Migration[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      number: Number.parseInt(name, 10),
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'),
    }))
}

describe('migration grant guard: checker logic', () => {
  const sql = `
    -- create table public.commented_out (id int);
    CREATE TABLE IF NOT EXISTS public.things (id uuid);
    create table "widgets" (id int);
    GRANT SELECT, INSERT ON public.things, public.widgets TO service_role, authenticated;
    GRANT SELECT ON public.things TO anon;
    GRANT SELECT ON public.widgets TO anon; -- public-on-purpose (shown on the homepage)
  `
  it('finds created tables, ignoring comments', () => {
    expect(createdTables(sql)).toEqual(['things', 'widgets'])
  })
  it('finds tables granted to a role, across multi-table/multi-role grants', () => {
    expect([...tablesGrantedTo(sql, 'service_role')].sort()).toEqual(['things', 'widgets'])
    expect([...tablesGrantedTo(sql, 'anon')].sort()).toEqual(['things', 'widgets'])
  })
  it('flags anon grants unless marked public-on-purpose', () => {
    expect(unmarkedAnonGrants(sql)).toEqual(['GRANT SELECT ON public.things TO anon;'])
  })
})

describe('supabase/migrations', () => {
  const migrations = loadMigrations()

  it('has migrations to check', () => {
    expect(migrations.length).toBeGreaterThan(100)
  })

  it('every table created gets a service_role grant (rule 1)', () => {
    const granted = new Set<string>()
    for (const m of migrations)
      for (const t of tablesGrantedTo(m.sql, 'service_role')) granted.add(t)
    const missing = migrations.flatMap((m) =>
      createdTables(m.sql)
        .filter((t) => !granted.has(t))
        .map((t) => `${m.name}: ${t}`),
    )
    expect(missing, 'Add GRANT … ON public.<table> TO service_role').toEqual([])
  })

  it(`from ${STRICT_FROM} on, a new table is granted in the migration that creates it (rule 2)`, () => {
    const missing = migrations
      .filter((m) => m.number >= STRICT_FROM)
      .flatMap((m) => {
        const granted = tablesGrantedTo(m.sql, 'service_role')
        return createdTables(m.sql)
          .filter((t) => !granted.has(t))
          .map((t) => `${m.name}: ${t}`)
      })
    expect(
      missing,
      'Supabase gives new tables no API access without a grant in the same migration',
    ).toEqual([])
  })

  it(`from ${STRICT_FROM} on, any grant to anon is marked deliberate (rule 3)`, () => {
    const unmarked = migrations
      .filter((m) => m.number >= STRICT_FROM)
      .flatMap((m) => unmarkedAnonGrants(m.sql).map((l) => `${m.name}: ${l}`))
    expect(
      unmarked,
      `anon = anyone on the internet. Only grant it for data that is public, with "-- ${PUBLIC_MARK}"`,
    ).toEqual([])
  })
})
