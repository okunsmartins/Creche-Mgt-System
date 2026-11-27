// @vitest-environment node
//
// Migration 114 limits get_user_permissions() to "the server, or the user asking about
// themselves". It can't run against Postgres in CI, so the safety-relevant parts of its
// SQL are pinned here; the live check is scripts/verify-mfa-policies.mjs (anon blocked).

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const stripSqlComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '')

const dir = path.resolve(process.cwd(), 'supabase/migrations')
const file = fs.readdirSync(dir).find((f) => f.startsWith('114_'))!
const raw = fs.readFileSync(path.join(dir, file), 'utf8')
const sql = stripSqlComments(raw).replace(/\s+/g, ' ').toLowerCase()

describe('migration 114: get_user_permissions is self-only', () => {
  it('is the only migration numbered 114', () => {
    expect(fs.readdirSync(dir).filter((f) => f.startsWith('114_'))).toEqual([file])
  })

  it('keeps the same signature and return type (the app calls it by name)', () => {
    expect(sql).toContain(
      'create or replace function public.get_user_permissions(p_user_id uuid, p_school_id uuid) returns text[]',
    )
  })

  it('a signed-in user only matches themselves; no uid = server / SQL editor', () => {
    expect(sql).toContain('and (auth.uid() is null or p_user_id = auth.uid())')
  })

  it('pins search_path and stays SECURITY DEFINER with schema-qualified tables', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    for (const t of ['public.user_roles', 'public.role_permissions', 'public.permissions'])
      expect(sql).toContain(t)
  })

  it('anon cannot call it; signed-in users and the service role can', () => {
    expect(sql).toContain(
      'revoke all on function public.get_user_permissions(uuid, uuid) from public, anon;',
    )
    expect(sql).toContain(
      'grant execute on function public.get_user_permissions(uuid, uuid) to authenticated, service_role;',
    )
    expect(sql).not.toMatch(/grant [^;]*get_user_permissions[^;]*\banon\b/)
  })

  it('documents how to roll back', () => {
    expect(raw).toMatch(/Rollback/)
  })
})

describe('the app reads permissions with the service role', () => {
  it('session.ts calls get_user_permissions on the admin (service-role) client', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/auth/session.ts'), 'utf8')
    expect(src).toMatch(/adminClient\.rpc\('get_user_permissions'/)
    expect(src).not.toMatch(/\bsupabase\.rpc\('get_user_permissions'/)
  })
})
