import { getLocalEvaluations } from '@/lib/demo/localStore'
import { DEMO_DEAL_ID } from '@/lib/demo/seedDemo'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { getTriggerRules } from './triggers'
import { mapEvaluation } from './mappers'
import type { TriggerEvaluation } from '@/lib/types/trigger'

export async function getEvaluations(dealId = DEMO_DEAL_ID): Promise<TriggerEvaluation[]> {
  if (!isSupabaseConfigured()) return getLocalEvaluations(dealId)

  const rules = await getTriggerRules(dealId)
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]))
  const ruleIds = rules.map((rule) => rule.id)

  if (!ruleIds.length) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('trigger_evaluations')
    .select('*')
    .in('rule_id', ruleIds)
    .order('evaluated_at', { ascending: true })

  if (error) throw error

  return data
    .map((row) => {
      const rule = ruleById.get(row.rule_id)
      return rule ? mapEvaluation(row, rule) : null
    })
    .filter((evaluation): evaluation is TriggerEvaluation => evaluation !== null)
}
