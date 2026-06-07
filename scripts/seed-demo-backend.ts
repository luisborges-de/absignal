import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import {
  demoDeal,
  demoEvaluations,
  demoSnapshots,
  demoTriggerRules,
  toDealRow,
  toEvaluationRow,
  toSnapshotRow,
  toTriggerRuleRow,
} from '../src/lib/demo/seedDemo'
import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/lib/brand'
import type { Database } from '../src/lib/supabase/types'

type Env = Record<string, string | undefined>

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

function loadDotEnv(path = '.env.local') {
  if (!fs.existsSync(path)) return

  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    const value = rest.join('=').replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function requireEnv(env: Env) {
  const missing: string[] = REQUIRED_ENV.filter((key) => !env[key] || env[key]?.startsWith('your-'))
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!publishableKey || publishableKey.startsWith('your-')) {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (missing.length) {
    throw new Error(`Missing required Supabase env vars: ${missing.join(', ')}`)
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: publishableKey as string,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY as string,
  }
}

async function assertNoError<T>(
  label: string,
  result: { data: T | null; error: { message: string } | null },
) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function main() {
  loadDotEnv()
  const env = requireEnv(process.env)
  const service = createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anon = createClient<Database>(env.url, env.anonKey)

  const userResult = await service.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'demo' },
  })

  if (userResult.error && !userResult.error.message.toLowerCase().includes('already')) {
    throw new Error(`create demo user: ${userResult.error.message}`)
  }

  await assertNoError(
    'seed deal',
    await service.from('deals').upsert(toDealRow(demoDeal), { onConflict: 'id' }),
  )
  await assertNoError(
    'seed trigger rules',
    await service.from('trigger_rules').upsert(demoTriggerRules.map(toTriggerRuleRow), {
      onConflict: 'id',
    }),
  )
  await assertNoError(
    'seed snapshots',
    await service.from('performance_snapshots').upsert(demoSnapshots.map(toSnapshotRow), {
      onConflict: 'id',
    }),
  )
  await assertNoError(
    'seed evaluations',
    await service.from('trigger_evaluations').upsert(demoEvaluations.map(toEvaluationRow), {
      onConflict: 'rule_id,snapshot_id',
    }),
  )

  const signIn = await anon.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (signIn.error) throw new Error(`demo sign in: ${signIn.error.message}`)

  const authed = anon
  const [deal, rules, snapshots, evaluations] = await Promise.all([
    authed.from('deals').select('id').eq('id', demoDeal.id).single(),
    authed.from('trigger_rules').select('id', { count: 'exact', head: true }).eq('deal_id', demoDeal.id),
    authed
      .from('performance_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', demoDeal.id),
    authed
      .from('trigger_evaluations')
      .select('id', { count: 'exact', head: true })
      .in(
        'rule_id',
        demoTriggerRules.map((rule) => rule.id),
      ),
  ])

  if (deal.error) throw new Error(`verify demo deal read: ${deal.error.message}`)
  if (rules.error) throw new Error(`verify trigger rules: ${rules.error.message}`)
  if (snapshots.error) throw new Error(`verify snapshots: ${snapshots.error.message}`)
  if (evaluations.error) throw new Error(`verify evaluations: ${evaluations.error.message}`)

  const expected = {
    rules: demoTriggerRules.length,
    snapshots: demoSnapshots.length,
    evaluations: demoEvaluations.length,
  }
  const actual = {
    rules: rules.count ?? 0,
    snapshots: snapshots.count ?? 0,
    evaluations: evaluations.count ?? 0,
  }

  if (actual.rules !== expected.rules) throw new Error(`expected ${expected.rules} rules, got ${actual.rules}`)
  if (actual.snapshots !== expected.snapshots) {
    throw new Error(`expected ${expected.snapshots} snapshots, got ${actual.snapshots}`)
  }
  if (actual.evaluations !== expected.evaluations) {
    throw new Error(`expected ${expected.evaluations} evaluations, got ${actual.evaluations}`)
  }

  console.log('Supabase demo backend is seeded and verified.')
  console.log(JSON.stringify({ dealId: demoDeal.id, ...actual }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
