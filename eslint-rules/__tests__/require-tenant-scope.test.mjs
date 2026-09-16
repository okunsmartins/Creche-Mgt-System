import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import rule from '../require-tenant-scope.mjs'

const ruleTester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
})

ruleTester.run('require-tenant-scope', rule, {
  valid: [
    // Filtered by school_id (a var assigned from the admin client).
    {
      code: `const a = createSupabaseAdminClient(); a.from('orders').select('*').eq('school_id', s)`,
    },
    // Filtered by another verified key — the rule doesn't judge which key.
    {
      code: `const a = createSupabaseAdminClient(); a.from('students').select('id').eq('class_id', c)`,
    },
    // Filtered via a chained call directly off the admin client.
    { code: `createSupabaseAdminClient().from('payments').select('*').in('id', ids)` },
    // Mutation (insert) — not a read.
    { code: `const a = createSupabaseAdminClient(); a.from('orders').insert({ school_id: s })` },
    // Insert that returns its own row.
    {
      code: `const a = createSupabaseAdminClient(); a.from('orders').insert(v).select('id').single()`,
    },
    // Non-tenant table (roles) — out of scope.
    { code: `const a = createSupabaseAdminClient(); a.from('roles').select('*')` },
    // `schools` is the tenant root (scoped by its own id), not a tenant table here.
    { code: `const a = createSupabaseAdminClient(); a.from('schools').select('*')` },
    // NOT the admin client — the RLS server client relies on policies.
    { code: `const s = createSupabaseServerClient(); s.from('orders').select('*')` },
    // Upsert — payload-based, no filter expected.
    { code: `const a = createSupabaseAdminClient(); a.from('school_settings').upsert(v)` },
    // Filtered update — scoped write is fine.
    {
      code: `const a = createSupabaseAdminClient(); a.from('orders').update(v).eq('school_id', s)`,
    },
    // Filtered delete — scoped write is fine.
    { code: `const a = createSupabaseAdminClient(); a.from('classes').delete().eq('id', c)` },
  ],
  invalid: [
    // Unfiltered read via an admin-client variable.
    {
      code: `const a = createSupabaseAdminClient(); a.from('orders').select('*')`,
      errors: [{ messageId: 'unfiltered' }],
    },
    // Unfiltered read directly off the admin client.
    {
      code: `createSupabaseAdminClient().from('students').select('id')`,
      errors: [{ messageId: 'unfiltered' }],
    },
    // `.order()` is not a row filter — still unfiltered.
    {
      code: `const a = createSupabaseAdminClient(); a.from('payments').select('*').order('created_at')`,
      errors: [{ messageId: 'unfiltered' }],
    },
    // `.single()` limits to one row but applies no filter — first of ALL schools' rows.
    {
      code: `const a = createSupabaseAdminClient(); a.from('subscriptions').select('*').single()`,
      errors: [{ messageId: 'unfiltered' }],
    },
    // Unfiltered UPDATE — a mass cross-tenant write (worse than a read).
    {
      code: `const a = createSupabaseAdminClient(); a.from('orders').update({ status: 'x' })`,
      errors: [{ messageId: 'unfiltered' }],
    },
    // Unfiltered DELETE.
    {
      code: `const a = createSupabaseAdminClient(); a.from('classes').delete()`,
      errors: [{ messageId: 'unfiltered' }],
    },
  ],
})
