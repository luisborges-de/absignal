import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { requireServiceRoleEnv, requireSupabaseEnv } from './env'
import type { Database } from './types'
import type { CookieMethodsServer } from '@supabase/ssr'

export function createClient() {
  const { url, anonKey } = requireSupabaseEnv()
  const cookieStore = cookies()

  return createServerClient<Database, 'public', Database['public']>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot set cookies; middleware refreshes sessions.
        }
      },
    },
  })
}

export function createServiceClient() {
  const { url, serviceRoleKey } = requireServiceRoleEnv()
  return createSupabaseClient<Database, 'public'>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
