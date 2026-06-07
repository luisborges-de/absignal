import { evaluateAllTriggers } from '@/lib/engine/triggerEngine'
import {
  DEMO_DEAL_ID,
  demoDeal,
  demoEvaluations,
  demoSnapshots,
  demoTriggerRules,
} from '@/lib/demo/seedDemo'
import type { Deal } from '@/lib/types/deal'
import type { PerformanceSnapshot } from '@/lib/types/performance'
import type { TriggerEvaluation, TriggerRule } from '@/lib/types/trigger'

const keys = {
  deals: 'absignal:deals',
  rules: 'absignal:trigger-rules',
  snapshots: 'absignal:snapshots',
  evaluations: 'absignal:evaluations',
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function read<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback
  const raw = window.localStorage.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  if (canUseStorage()) {
    window.localStorage.setItem(key, JSON.stringify(value))
  }
}

export function getLocalDeals(): Deal[] {
  return read(keys.deals, [demoDeal])
}

export function getLocalDeal(id: string): Deal | null {
  return getLocalDeals().find((deal) => deal.id === id) ?? null
}

export function getLocalTriggerRules(dealId = DEMO_DEAL_ID): TriggerRule[] {
  return read(keys.rules, demoTriggerRules).filter((rule) => rule.dealId === dealId)
}

export function addLocalTriggerRules(rules: TriggerRule[]) {
  const existing = read(keys.rules, demoTriggerRules)
  const next = [
    ...existing.filter((rule) => !rules.some((candidate) => candidate.id === rule.id)),
    ...rules,
  ]
  write(keys.rules, next)
  return rules
}

export function updateLocalTriggerStatus(ruleId: string, status: TriggerRule['extractionStatus']) {
  const next = read(keys.rules, demoTriggerRules).map((rule) =>
    rule.id === ruleId ? { ...rule, extractionStatus: status, updatedAt: new Date().toISOString() } : rule,
  )
  write(keys.rules, next)
  return next.find((rule) => rule.id === ruleId) ?? null
}

export function getLocalSnapshots(dealId = DEMO_DEAL_ID): PerformanceSnapshot[] {
  return read(keys.snapshots, demoSnapshots).filter((snapshot) => snapshot.dealId === dealId)
}

export function addLocalSnapshot(snapshot: PerformanceSnapshot) {
  const existing = read(keys.snapshots, demoSnapshots)
  const next = [
    ...existing.filter(
      (item) => !(item.dealId === snapshot.dealId && item.periodDate === snapshot.periodDate),
    ),
    snapshot,
  ].sort((a, b) => new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime())
  write(keys.snapshots, next)
  return snapshot
}

export function getLocalEvaluations(dealId = DEMO_DEAL_ID): TriggerEvaluation[] {
  return read(keys.evaluations, demoEvaluations).filter((evaluation) =>
    getLocalTriggerRules(dealId).some((rule) => rule.id === evaluation.ruleId),
  )
}

export function upsertLocalEvaluations(evaluations: TriggerEvaluation[]) {
  const existing = read(keys.evaluations, demoEvaluations)
  const next = [
    ...existing.filter((item) => !evaluations.some((evaluation) => evaluation.id === item.id)),
    ...evaluations,
  ]
  write(keys.evaluations, next)
  return evaluations
}

export function evaluateLocalSnapshot(dealId: string, snapshot: PerformanceSnapshot) {
  addLocalSnapshot(snapshot)
  const snapshots = getLocalSnapshots(dealId).filter((item) => item.periodDate <= snapshot.periodDate)
  const rules = getLocalTriggerRules(dealId).filter((rule) => rule.extractionStatus === 'APPROVED')
  const evaluations = evaluateAllTriggers(rules, snapshots)
  upsertLocalEvaluations(evaluations)
  return evaluations
}
