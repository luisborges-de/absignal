import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseConfigured, requireSupabaseEnv } from '@/lib/supabase/env'
import type { Database } from '@/lib/supabase/types'
import type { CookieMethodsServer } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next()

  let response = NextResponse.next({ request: { headers: request.headers } })
  const { url, anonKey } = requireSupabaseEnv()

  const supabase = createServerClient<Database, 'public', Database['public']>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/deals')) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = { matcher: ['/deals/:path*'] }
