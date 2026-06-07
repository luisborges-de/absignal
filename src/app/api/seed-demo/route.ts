import { NextResponse } from 'next/server'
import {
  demoDeal,
  demoEvaluations,
  demoSnapshots,
  demoTriggerRules,
  toDealRow,
  toEvaluationRow,
  toSnapshotRow,
  toTriggerRuleRow,
} from '@/lib/demo/seedDemo'
import { isServiceRoleConfigured } from '@/lib/supabase/env'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  if (process.env.ENABLE_DEMO_SEED !== 'true') {
    return NextResponse.json({ error: 'Demo seed is disabled.' }, { status: 403 })
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 500 })
  }

  const supabase = createServiceClient()
  const deal = await supabase.from('deals').upsert(toDealRow(demoDeal), { onConflict: 'id' })
  if (deal.error) return NextResponse.json({ error: deal.error.message }, { status: 500 })

  const rules = await supabase
    .from('trigger_rules')
    .upsert(demoTriggerRules.map(toTriggerRuleRow), { onConflict: 'id' })
  if (rules.error) return NextResponse.json({ error: rules.error.message }, { status: 500 })

  const snapshots = await supabase
    .from('performance_snapshots')
    .upsert(demoSnapshots.map(toSnapshotRow), { onConflict: 'id' })
  if (snapshots.error) return NextResponse.json({ error: snapshots.error.message }, { status: 500 })

  const evaluations = await supabase
    .from('trigger_evaluations')
    .upsert(demoEvaluations.map(toEvaluationRow), { onConflict: 'rule_id,snapshot_id' })
  if (evaluations.error) return NextResponse.json({ error: evaluations.error.message }, { status: 500 })

  return NextResponse.json({
    dealId: demoDeal.id,
    rules: demoTriggerRules.length,
    snapshots: demoSnapshots.length,
    evaluations: demoEvaluations.length,
  })
}
