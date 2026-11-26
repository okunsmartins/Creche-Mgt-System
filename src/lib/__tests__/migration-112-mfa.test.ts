// @vitest-environment node
//
// Migration 112 enforces two-step sign-in (TOTP) in the database. It can't be run
// against a real Postgres in CI, so these tests pin down the parts that matter for
// safety in its SQL text. The live behaviour is checked after applying with
// supabase/checks/112_mfa_check.sql and scripts/verify-mfa-policies.mjs.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/** Remove SQL comments (block and line) so commented-out text doesn't count. */
const stripSqlComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')

const dir = path.resolve(process.cwd(), 'supabase/migrations')
const file = fs.readdirSync(dir).find((f) => f.startsWith('112_'))!
const raw = fs.readFileSync(path.join(dir, file), 'utf8')
const sql = stripSqlComments(raw).replace(/\s+/g, ' ').toLowerCase()

/** The body of `create or replace function public.<name>(…) … $$ … $$`. */
function fn(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`)
  expect(start, `function ${name} defined`).toBeGreaterThan(-1)
  const open = sql.indexOf('$$', start)
  const close = sql.indexOf('$$', open + 2)
  return sql.slice(start, close + 2)
}

describe('migration 112: two-step sign-in in the database', () => {
  it('is the only migration numbered 112', () => {
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('112_'))).toEqual([file])
  })

  describe('mfa_satisfied()', () => {
    const body = fn('mfa_satisfied')
    it('passes a session where the code was entered (aal2)', () => {
      expect(body).toContain("coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'")
    })
    it('passes users with no verified authenticator (parents, staff, admins in grace)', () => {
      expect(body).toMatch(
        /or not exists \( select 1 from auth\.mfa_factors f where f\.user_id = auth\.uid\(\) and f\.status = 'verified' \)/,
      )
    })
    it('a missing aal claim counts as password-only, never as aal2', () => {
      expect(body).toContain("coalesce(auth.jwt() ->> 'aal', 'aal1')")
    })
    it('is executable by signed-in users only, never anon', () => {
      expect(sql).toContain(
        'grant execute on function public.mfa_satisfied() to authenticated, service_role;',
      )
      expect(sql).not.toMatch(/grant execute on function public\.mfa_satisfied\(\) to [^;]*anon/)
    })
    it('anon is revoked explicitly by 113 (Supabase grants new functions to anon by default)', () => {
      // Found live 2026-11-26: revoking from PUBLIC left the direct anon grant in place.
      const fix = fs.readdirSync(dir).find((f) => f.startsWith('113_'))!
      const fixSql = stripSqlComments(fs.readFileSync(path.join(dir, fix), 'utf8'))
        .replace(/\s+/g, ' ')
        .toLowerCase()
      expect(fixSql).toContain('revoke execute on function public.mfa_satisfied() from anon;')
      expect(fixSql).not.toMatch(/\b(grant|create|drop|alter)\b/)
    })
    it('runs as the owner with a locked search_path, so API roles never need auth-schema access', () => {
      // Invoker rights would make every signed-in query fail if `authenticated` can't
      // read auth.mfa_factors. Definer is safe here: yes/no about the caller's own factors.
      expect(body).toContain('security definer')
      expect(body).toContain("set search_path = ''")
      expect(body).not.toMatch(/\bfrom (?!auth\.mfa_factors)[a-z_]+\./) // reads nothing else
    })
    it('only ever looks at the CALLER (auth.uid()), never a passed-in user', () => {
      expect(sql).toContain('create or replace function public.mfa_satisfied() returns boolean')
      expect(body).toContain('f.user_id = auth.uid()')
    })
  })

  describe('the policy', () => {
    const body = fn('ensure_mfa_policy')
    it('is RESTRICTIVE (AND-ed with existing policies, so it can only take access away)', () => {
      expect(body).toContain('as restrictive for all to authenticated')
    })
    it('checks both reads (using) and writes (with check), evaluated once per statement', () => {
      expect(body).toContain('using ((select public.mfa_satisfied()))')
      expect(body).toContain('with check ((select public.mfa_satisfied()))')
    })
    it('is idempotent (drop then create) and quotes the table name', () => {
      expect(body).toContain("'drop policy if exists mfa_required on public.%i'")
      expect(body).toContain('on public.%i as restrictive')
    })
    it('does not touch anon (anon has no MFA) or the service role (bypasses RLS)', () => {
      expect(body).not.toMatch(/to (anon|service_role|public)\b/)
    })
  })

  it('is applied to every RLS-enabled table in public', () => {
    expect(sql).toMatch(
      /for r in select c\.relname from pg_catalog\.pg_class c join pg_catalog\.pg_namespace ns on ns\.oid = c\.relnamespace where ns\.nspname = 'public' and c\.relkind in \('r', 'p'\) and c\.relrowsecurity loop perform public\.ensure_mfa_policy\(r\.relname\)/,
    )
  })

  it('warns about any table with RLS off (no policy can protect it)', () => {
    expect(sql).toContain("raise warning 'rls is off (not covered by mfa_required): %'")
  })

  describe('function access', () => {
    it('ensure_mfa_policy is not callable through the API', () => {
      expect(sql).toContain(
        'revoke all on function public.ensure_mfa_policy(text) from public, anon, authenticated;',
      )
      expect(sql).not.toMatch(/grant execute on function public\.ensure_mfa_policy/)
    })
    it('mfa_policy_gaps (catalog report) is service-role only', () => {
      expect(sql).toContain(
        'revoke all on function public.mfa_policy_gaps() from public, anon, authenticated;',
      )
      expect(sql).toContain('grant execute on function public.mfa_policy_gaps() to service_role;')
    })
    it('mfa_policy_gaps reports RLS-off tables and tables without the restrictive policy', () => {
      const body = fn('mfa_policy_gaps')
      expect(body).toContain("when not c.relrowsecurity then 'rls_off' else 'no_mfa_policy'")
      expect(body).toContain("p.policyname = 'mfa_required'")
      expect(body).toContain("p.permissive = 'restrictive'")
      expect(body).toContain("set search_path = ''")
    })
  })

  it('documents how to roll back', () => {
    expect(raw).toMatch(/Rollback/)
    expect(raw).toContain('drop policy if exists mfa_required on public.%I')
  })
})

describe('supabase/checks/112_mfa_check.sql', () => {
  const check = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/checks/112_mfa_check.sql'),
    'utf8',
  )
  const code = stripSqlComments(check).toLowerCase()

  it('is read-only: no writes, and it always ends by raising (which undoes everything)', () => {
    expect(code).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/)
    const last = code
      .trim()
      .split(/raise exception/)
      .pop()!
    expect(last).toContain("'mfa check (nothing was changed)")
  })

  it('checks password-only, with-code and parent sessions as the API role', () => {
    expect(code.match(/set local role authenticated/g)).toHaveLength(3)
    expect(code).toContain("'aal', 'aal1'")
    expect(code).toContain("'aal', 'aal2'")
  })
})
