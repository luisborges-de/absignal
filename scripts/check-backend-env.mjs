import fs from 'node:fs'

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

function loadDotEnv(path = '.env.local') {
  if (!fs.existsSync(path)) return {}

  return Object.fromEntries(
    fs
      .readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const [key, ...rest] = line.split('=')
        return [key, rest.join('=').replace(/^['"]|['"]$/g, '')]
      }),
  )
}

const env = { ...loadDotEnv(), ...process.env }
const missing = REQUIRED_ENV.filter((key) => !env[key] || env[key].startsWith('your-'))
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!publishableKey || publishableKey.startsWith('your-')) {
  missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

if (missing.length) {
  console.error(`Missing required Supabase env vars: ${missing.join(', ')}`)
  console.error('Create .env.local from .env.example, then run npm run backend:seed.')
  process.exit(1)
}

console.log('Supabase env vars are present.')
