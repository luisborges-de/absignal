import { NextResponse } from 'next/server'
import { evaluateAllTriggers, resolveWaterfallState } from '@/lib/engine/triggerEngine'
import { evaluateLocalSnapshot } from '@/lib/demo/localStore'
import { DEMO_DEAL_ID, toEvaluationRow } from '@/lib/demo/seedDemo'
import { isServiceRoleConfigured, isSupabaseConfigured } from '@/lib/supabase/env'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSnapshots } from '@/lib/supabase/queries/snapshots'
import { mapSnapshot, mapTriggerRule } from '@/lib/supabase/queries/mappers'
import type { PerformanceSnapshot } from '@/lib/types/performance'

interface EvaluateRequest {
  dealId: string
  snapshotId: string
  snapshot?: PerformanceSnapshot
}

function isEvaluateRequest(value: unknown): value is EvaluateRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.dealId === 'string' && typeof candidate.snapshotId === 'string'
}

export async function POST(request: Request) {
  const body = (await request.json()) as unknown
  if (!isEvaluateRequest(body)) {
    return NextResponse.json({ error: 'dealId and snapshotId are required.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    const snapshot =
      body.snapshot ??
      (await getSnapshots(body.dealId || DEMO_DEAL_ID)).find((item) => item.id === body.snapshotId)

    if (!snapshot) return NextResponse.json({ error: 'Snapshot not found.' }, { status: 404 })

    const evaluations = evaluateLocalSnapshot(body.dealId, snapshot)
    return NextResponse.json({
      evaluations,
      waterfallState: resolveWaterfallState(evaluations),
    })
  }

  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 500 })
  }

  const [rulesResult, snapshotsResult] = await Promise.all([
    supabase
      .from('trigger_rules')
      .select('*')
      .eq('deal_id', body.dealId)
      .eq('extraction_status', 'APPROVED')
      .order('created_at', { ascending: true }),
    supabase
      .from('performance_snapshots')
      .select('*')
      .eq('deal_id', body.dealId)
      .order('period_date', { ascending: true }),
  ])

  if (rulesResult.error) return NextResponse.json({ error: rulesResult.error.message }, { status: 500 })
  if (snapshotsResult.error) {
    return NextResponse.json({ error: snapshotsResult.error.message }, { status: 500 })
  }

  const rules = rulesResult.data.map(mapTriggerRule)
  const snapshots = snapshotsResult.data.map(mapSnapshot)
  const approvedRules = rules.filter((rule) => rule.extractionStatus === 'APPROVED')
  const selectedPeriod =
    body.snapshot?.periodDate ??
    snapshots.find((snapshot) => snapshot.id === body.snapshotId)?.periodDate ??
    '9999-12-31'
  const orderedSnapshots = snapshots
    .filter((snapshot) => snapshot.periodDate <= selectedPeriod)
    .slice(-3)
  const evaluations = evaluateAllTriggers(approvedRules, orderedSnapshots)
  const service = createServiceClient()
  const { error } = await service
    .from('trigger_evaluations')
    .upsert(evaluations.map(toEvaluationRow), { onConflict: 'rule_id,snapshot_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    evaluations,
    waterfallState: resolveWaterfallState(evaluations),
  })
}
