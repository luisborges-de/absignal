import {
  addLocalTriggerRules,
  getLocalTriggerRules,
  updateLocalTriggerStatus,
} from '@/lib/demo/localStore'
import { DEMO_DEAL_ID } from '@/lib/demo/seedDemo'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { mapTriggerRule } from './mappers'
import type { ExtractedRuleCandidate, TriggerRule } from '@/lib/types/trigger'

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function makeRule(dealId: string, candidate: ExtractedRuleCandidate): TriggerRule {
  const timestamp = new Date().toISOString()

  return {
    id: randomId(),
    dealId,
    family: candidate.family,
    name: candidate.name,
    description: candidate.description,
    metricKey: candidate.metricKey,
    operator: candidate.operator,
    threshold: candidate.threshold,
    thresholdUnit: candidate.thresholdUnit,
    lookbackPeriods: candidate.lookbackPeriods,
    consequence: candidate.consequence,
    sectionReference: candidate.sectionReference,
    sourceText: candidate.sourceText,
    extractionStatus: 'EXTRACTED',
    extractionConfidence: candidate.extractionConfidence,
    watchBuffer: candidate.watchBuffer,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function toRuleRow(rule: TriggerRule) {
  return {
    id: rule.id,
    deal_id: rule.dealId,
    family: rule.family,
    name: rule.name,
    description: rule.description,
    metric_key: rule.metricKey,
    operator: rule.operator,
    threshold: rule.threshold,
    threshold_unit: rule.thresholdUnit,
    lookback_periods: rule.lookbackPeriods,
    consequence: rule.consequence,
    section_reference: rule.sectionReference,
    source_text: rule.sourceText,
    extraction_status: rule.extractionStatus,
    extraction_confidence: rule.extractionConfidence,
    watch_buffer: rule.watchBuffer,
    active: rule.active,
  }
}

export async function getTriggerRules(dealId = DEMO_DEAL_ID) {
  if (!isSupabaseConfigured()) return getLocalTriggerRules(dealId)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('trigger_rules')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data.map(mapTriggerRule)
}

export async function updateTriggerRuleStatus({
  ruleId,
  status,
}: {
  ruleId: string
  status: TriggerRule['extractionStatus']
}) {
  if (!isSupabaseConfigured()) {
    const updated = updateLocalTriggerStatus(ruleId, status)
    if (!updated) throw new Error('Trigger rule not found')
    return updated
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('trigger_rules')
    .update({ extraction_status: status })
    .eq('id', ruleId)
    .select('*')
    .single()

  if (error) throw error
  return mapTriggerRule(data)
}

export async function upsertExtractedRules({
  dealId,
  candidates,
}: {
  dealId: string
  candidates: ExtractedRuleCandidate[]
}) {
  const rules = candidates.map((candidate) => makeRule(dealId, candidate))

  if (!isSupabaseConfigured()) {
    return addLocalTriggerRules(rules)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('trigger_rules')
    .upsert(rules.map(toRuleRow), { onConflict: 'id' })
    .select('*')

  if (error) throw error
  return data.map(mapTriggerRule)
}
