import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import type { CookieOptions } from '@supabase/ssr'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

/**
 * Supabase client for Server Components and Route Handlers.
 * Uses the anon key + RLS so it respects row-level security policies.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as Partial<ResponseCookie>)
            })
          } catch {
            // Cookies cannot be set in Server Components — only Route Handlers / Actions
          }
        },
      },
    },
  )
}

/**
 * Supabase admin client using the service role key.
 * Bypasses RLS — use only in trusted server-side contexts.
 * NEVER expose the service role key to browser code.
 *
 * Schema is explicitly `any` so insert/update calls accept concrete object
 * literals. `createClient` from supabase-js defaults Schema to `never` when
 * Database['public'] doesn't fully satisfy GenericSchema, making all write
 * values `never`. Passing `any` for Schema is safe here — runtime behaviour
 * is identical, only the inferred types differ.
 */
export function createSupabaseAdminClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Schema=any is intentional; see JSDoc above
  return createClient<Database, 'public', any>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
