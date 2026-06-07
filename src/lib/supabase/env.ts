const PLACEHOLDER_URL = 'https://your-project.supabase.co'
const PLACEHOLDER_KEYS = new Set([
  'your-anon-key',
  'your-publishable-key',
  'your-publishable-or-anon-key',
])

function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = getSupabasePublishableKey()
  return Boolean(url && anonKey && url !== PLACEHOLDER_URL && !PLACEHOLDER_KEYS.has(anonKey))
}

export function isServiceRoleConfigured() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return isSupabaseConfigured() && Boolean(key && key !== 'your-service-role-key')
}

export function requireSupabaseEnv() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase environment variables are not configured.')
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: getSupabasePublishableKey() as string,
  }
}

export function requireServiceRoleEnv() {
  const env = requireSupabaseEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey || serviceRoleKey === 'your-service-role-key') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  }

  return { ...env, serviceRoleKey }
}
