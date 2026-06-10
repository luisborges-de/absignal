import { evaluateAllTriggers } from '@/lib/engine/triggerEngine'
import {
  DEMO_DEAL_ID,
  demoDeals,
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
  return read<Deal[]>(keys.deals, [])
}

export function getLocalDeal(id: string): Deal | null {
  return getLocalDeals().find((deal) => deal.id === id) ?? null
}

export function addLocalDeal(deal: Deal) {
  const existing = getLocalDeals()
  const next = [deal, ...existing.filter((item) => item.id !== deal.id)]
  write(keys.deals, next)
  return deal
}

export function getLocalTriggerRules(dealId = DEMO_DEAL_ID): TriggerRule[] {
  return read<TriggerRule[]>(keys.rules, []).filter((rule) => rule.dealId === dealId)
}

export function addLocalTriggerRules(rules: TriggerRule[]) {
  const existing = read<TriggerRule[]>(keys.rules, [])
  const next = [
    ...existing.filter((rule) => !rules.some((candidate) => candidate.id === rule.id)),
    ...rules,
  ]
  write(keys.rules, next)
  return rules
}

export function updateLocalTriggerStatus(ruleId: string, status: TriggerRule['extractionStatus']) {
  const next = read<TriggerRule[]>(keys.rules, []).map((rule) =>
    rule.id === ruleId ? { ...rule, extractionStatus: status, updatedAt: new Date().toISOString() } : rule,
  )
  write(keys.rules, next)
  return next.find((rule) => rule.id === ruleId) ?? null
}

export function getLocalSnapshots(dealId = DEMO_DEAL_ID): PerformanceSnapshot[] {
  return read<PerformanceSnapshot[]>(keys.snapshots, []).filter((snapshot) => snapshot.dealId === dealId)
}

export function addLocalSnapshot(snapshot: PerformanceSnapshot) {
  const existing = read<PerformanceSnapshot[]>(keys.snapshots, [])
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
  return read<TriggerEvaluation[]>(keys.evaluations, []).filter((evaluation) =>
    getLocalTriggerRules(dealId).some((rule) => rule.id === evaluation.ruleId),
  )
}

export function upsertLocalEvaluations(evaluations: TriggerEvaluation[]) {
  const existing = read<TriggerEvaluation[]>(keys.evaluations, [])
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

/** True when the browser has any locally-persisted deals (real uploads or loaded demo). */
export function hasLocalData() {
  return getLocalDeals().length > 0
}

/** One-click fallback for live demos: seed the 5 sample deals into local storage. */
export function loadDemoData() {
  write(keys.deals, demoDeals)
  write(keys.rules, demoTriggerRules)
  write(keys.snapshots, demoSnapshots)
  write(keys.evaluations, demoEvaluations)
}

/** Wipe all locally-persisted deals/rules/snapshots/evaluations. */
export function clearDemoData() {
  if (!canUseStorage()) return
  for (const key of Object.values(keys)) window.localStorage.removeItem(key)
}
