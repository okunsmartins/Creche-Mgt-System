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
//     a `-- public-on-purpose` comment on the line that ends the statement.
//  4. From migration MFA_FROM on, a new table gets the two-step sign-in rule in the SAME
//     migration: `select public.ensure_mfa_policy('<table>');` (see migration 112).
//  5. From migration FN_FROM on, a new function in `public` revokes EXECUTE from anon in
//     the SAME migration (Supabase grants it to anon by default, and revoking from PUBLIC
//     doesn't remove that), unless its `create function` line is marked
//     `-- public-on-purpose`. Found live after migration 112 (fixed by 113).

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations')
/** First migration number the stricter rules (2, 3) apply to. */
const STRICT_FROM = 111
const PUBLIC_MARK = 'public-on-purpose'
/** First migration number rule 4 applies to (112 added the rule to every existing table). */
const MFA_FROM = 113
/** First migration number rule 5 applies to. */
const FN_FROM = 113

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
  // Optional schema: only `public.x` or unqualified `x` count (Supabase exposes `public`).
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?([a-z_0-9]+)"?\.)?"?([a-z_0-9]+)"?/gi
  return [...stripSqlComments(sql).matchAll(re)]
    .filter((m) => !m[1] || m[1].toLowerCase() === 'public')
    .map((m) => m[2]!.toLowerCase())
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

/** `GRANT … TO anon` statements (single- or multi-line) not marked as deliberately public. */
export function unmarkedAnonGrants(sql: string): string[] {
  // Blank out comments but keep every character position, so a statement found in the
  // code maps back to the raw text (which still has the marker comment).
  const code = sql
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (c) => ' '.repeat(c.length))
  const hits: string[] = []
  for (const m of code.matchAll(/\bgrant\b[^;]*;/gi)) {
    if (!/\bto\b[\s\S]*\banon\b/i.test(m[0])) continue
    const start = m.index!
    const end = start + m[0].length
    // The statement's raw text plus the rest of the line its `;` is on.
    const lineEnd = sql.indexOf('\n', end)
    const raw = sql.slice(start, lineEnd === -1 ? sql.length : lineEnd)
    if (!raw.includes(PUBLIC_MARK)) hits.push(m[0].replace(/\s+/g, ' ').trim())
  }
  return hits
}

/** Tables given the `mfa_required` policy via ensure_mfa_policy('<table>') in this SQL. */
export function tablesWithMfaPolicy(sql: string): Set<string> {
  const re = /ensure_mfa_policy\s*\(\s*'(?:public\.)?"?([a-z_0-9]+)"?'\s*\)/gi
  return new Set([...stripSqlComments(sql).matchAll(re)].map((m) => m[1]!.toLowerCase()))
}

/** Functions created in the public schema (or unqualified), with their raw line. */
export function createdFunctions(sql: string): { name: string; line: string }[] {
  // Blank out comments but keep positions, so the raw line (with any marker) is found.
  const code = sql
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (c) => ' '.repeat(c.length))
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:"?([a-z_0-9]+)"?\.)?"?([a-z_0-9]+)"?\s*\(/gi
  return [...code.matchAll(re)]
    .filter((m) => !m[1] || m[1].toLowerCase() === 'public')
    .map((m) => {
      const lineStart = sql.lastIndexOf('\n', m.index!) + 1
      const lineEnd = sql.indexOf('\n', m.index!)
      return {
        name: m[2]!.toLowerCase(),
        line: sql.slice(lineStart, lineEnd === -1 ? undefined : lineEnd),
      }
    })
}

/** Functions that get `REVOKE … ON FUNCTION … FROM … anon` in this SQL. */
export function functionsRevokedFromAnon(sql: string): Set<string> {
  const out = new Set<string>()
  const re = /revoke\s+[^;]*?\bon\s+function\s+([^;]*?)\s+from\s+([^;]*);/gi
  for (const m of stripSqlComments(sql).matchAll(re)) {
    if (
      !m[2]!
        .toLowerCase()
        .split(/[\s,]+/)
        .includes('anon')
    )
      continue
    // Drop argument lists first: `f(text, int), g()` → `f, g`.
    for (const f of m[1]!.replace(/\([^)]*\)/g, '').split(',')) {
      const name = f
        .trim()
        .replace(/^public\./i, '')
        .replace(/"/g, '')
        .toLowerCase()
      if (name) out.add(name)
    }
  }
  return out
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

describe('migration grant guard: review 2026-11-20 regressions', () => {
  it('catches a grant to anon split over two lines', () => {
    const sql = ['GRANT SELECT ON public.things', '  TO anon;', ''].join('\n')
    expect(unmarkedAnonGrants(sql)).toEqual(['GRANT SELECT ON public.things TO anon;'])
  })
  it('accepts a multi-line anon grant marked on its last line', () => {
    const sql = ['GRANT SELECT ON public.things', '  TO anon; -- public-on-purpose', ''].join('\n')
    expect(unmarkedAnonGrants(sql)).toEqual([])
  })
  it('ignores a commented-out anon grant', () => {
    expect(unmarkedAnonGrants('-- GRANT SELECT ON public.x TO anon;\n')).toEqual([])
  })
  it('does not treat REVOKE … FROM anon as a grant', () => {
    expect(unmarkedAnonGrants('REVOKE SELECT ON public.x FROM anon;\n')).toEqual([])
  })
  it('only counts tables in the public schema', () => {
    const sql = [
      'create table private.secrets (id int);',
      'create table public.ok (id int);',
      'create table plain (id int);',
    ].join('\n')
    expect(createdTables(sql)).toEqual(['ok', 'plain'])
  })
})

describe('migration guard: two-step sign-in rule (rule 4)', () => {
  it('finds tables given the policy, ignoring comments', () => {
    const sql = [
      "select public.ensure_mfa_policy('things');",
      "SELECT ensure_mfa_policy( 'public.widgets' );",
      "-- select public.ensure_mfa_policy('ghost');",
    ].join('\n')
    expect([...tablesWithMfaPolicy(sql)].sort()).toEqual(['things', 'widgets'])
  })
})

describe('migration guard: function access (rule 5)', () => {
  it('finds public functions and anon revokes, ignoring comments and other schemas', () => {
    const sql = [
      'create or replace function public.a(p text, q int) returns int language sql as $$ select 1 $$;',
      'CREATE FUNCTION b() returns int language sql as $$ select 1 $$;',
      'create function private.c() returns int language sql as $$ select 1 $$;',
      '-- create function public.ghost() returns int;',
      'revoke all on function public.a(text, int), b() from public, anon, authenticated;',
    ].join('\n')
    expect(createdFunctions(sql).map((f) => f.name)).toEqual(['a', 'b'])
    expect([...functionsRevokedFromAnon(sql)].sort()).toEqual(['a', 'b'])
  })
  it('revoking from PUBLIC only does not count (the 112 mistake)', () => {
    const sql = 'revoke all on function public.mfa_satisfied() from public;'
    expect(functionsRevokedFromAnon(sql).size).toBe(0)
  })
  it('keeps the raw line so a public-on-purpose marker can be seen', () => {
    const sql =
      'create function public.open_hours() returns int -- public-on-purpose\nlanguage sql as $$ select 1 $$;'
    expect(createdFunctions(sql)[0]!.line).toContain('public-on-purpose')
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

  it(`from ${MFA_FROM} on, a new table gets the two-step sign-in rule (rule 4)`, () => {
    const missing = migrations
      .filter((m) => m.number >= MFA_FROM)
      .flatMap((m) => {
        const covered = tablesWithMfaPolicy(m.sql)
        return createdTables(m.sql)
          .filter((t) => !covered.has(t))
          .map((t) => `${m.name}: ${t}`)
      })
    expect(
      missing,
      "Add `select public.ensure_mfa_policy('<table>');` after enabling RLS (migration 112)",
    ).toEqual([])
  })

  it(`from ${FN_FROM} on, a new function revokes EXECUTE from anon (rule 5)`, () => {
    const missing = migrations
      .filter((m) => m.number >= FN_FROM)
      .flatMap((m) => {
        const revoked = functionsRevokedFromAnon(m.sql)
        return createdFunctions(m.sql)
          .filter((f) => !revoked.has(f.name) && !f.line.includes(PUBLIC_MARK))
          .map((f) => `${m.name}: ${f.name}`)
      })
    expect(
      missing,
      `Supabase lets anon call new functions by default: add "revoke execute on function public.<fn>(…) from anon;" (or mark the create line "-- ${PUBLIC_MARK}")`,
    ).toEqual([])
  })
})
