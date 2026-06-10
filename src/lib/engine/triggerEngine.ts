import type { WaterfallStateType } from '@/lib/types/deal'
import type { PerformanceSnapshot } from '@/lib/types/performance'
import type {
  TriggerEvaluation,
  TriggerOperator,
  TriggerRule,
  TriggerStatus,
} from '@/lib/types/trigger'

type NumericSnapshotKey = {
  [K in keyof PerformanceSnapshot]: PerformanceSnapshot[K] extends number ? K : never
}[keyof PerformanceSnapshot]

const EPSILON = 1e-9

function byPeriodAsc(a: PerformanceSnapshot, b: PerformanceSnapshot) {
  return new Date(a.periodDate).getTime() - new Date(b.periodDate).getTime()
}

function readMetric(snapshot: PerformanceSnapshot, metricKey: string): number | null {
  if (!(metricKey in snapshot)) return null
  const value = snapshot[metricKey as NumericSnapshotKey]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function comparisonFires(operator: TriggerOperator, currentValue: number, threshold: number | null) {
  if (operator === 'BINARY') return currentValue >= 1
  if (threshold === null) return false

  switch (operator) {
    case 'LT':
      return currentValue < threshold - EPSILON
    case 'LTE':
      return currentValue <= threshold + EPSILON
    case 'GT':
      return currentValue > threshold + EPSILON
    case 'GTE':
      return currentValue >= threshold - EPSILON
    case 'EQ':
      return Math.abs(currentValue - threshold) <= EPSILON
  }
}

function distanceToBreachPct(
  operator: TriggerOperator,
  currentValue: number,
  threshold: number | null,
) {
  if (threshold === null || threshold === 0 || operator === 'BINARY') return null
  const denominator = Math.abs(threshold)

  if (operator === 'GT' || operator === 'GTE') {
    return (threshold - currentValue) / denominator
  }

  if (operator === 'LT' || operator === 'LTE') {
    return (currentValue - threshold) / denominator
  }

  return 1 - Math.abs(currentValue - threshold) / denominator
}

function statusFromDistance(
  rule: TriggerRule,
  currentValue: number,
  distance: number | null,
): TriggerStatus {
  if (comparisonFires(rule.operator, currentValue, rule.threshold)) return 'BREACH'
  if (distance !== null && distance > 0 && distance < rule.watchBuffer) return 'WATCH'
  return 'SAFE'
}

function unavailable(rule: TriggerRule, snapshotId: string): TriggerEvaluation {
  return {
    id: `${rule.id}:${snapshotId}`,
    ruleId: rule.id,
    snapshotId,
    family: rule.family,
    consequence: rule.consequence,
    status: 'N/A',
    currentValue: null,
    threshold: rule.threshold,
    distanceToBreachPct: null,
    lookbackValues: [],
    evaluatedAt: new Date().toISOString(),
  }
}

export function evaluateTrigger(
  rule: TriggerRule,
  snapshots: PerformanceSnapshot[],
): TriggerEvaluation {
  const sorted = [...snapshots].sort(byPeriodAsc)
  const latestSnapshot = sorted[sorted.length - 1]
  const snapshotId = latestSnapshot?.id ?? 'NO_SNAPSHOT'

  if (!rule.active || sorted.length < rule.lookbackPeriods) {
    return unavailable(rule, snapshotId)
  }

  const lookback = sorted.slice(-rule.lookbackPeriods)
  const lookbackValues = lookback
    .map((snapshot) => readMetric(snapshot, rule.metricKey))
    .filter((value): value is number => value !== null)

  if (lookbackValues.length < rule.lookbackPeriods) {
    return unavailable(rule, snapshotId)
  }

  const currentValue =
    lookbackValues.reduce((total, value) => total + value, 0) / lookbackValues.length
  const distance = distanceToBreachPct(rule.operator, currentValue, rule.threshold)

  return {
    id: `${rule.id}:${snapshotId}`,
    ruleId: rule.id,
    snapshotId,
    family: rule.family,
    consequence: rule.consequence,
    status: statusFromDistance(rule, currentValue, distance),
    currentValue,
    threshold: rule.threshold,
    distanceToBreachPct: distance,
    lookbackValues,
    evaluatedAt: new Date().toISOString(),
  }
}

export function evaluateAllTriggers(
  rules: TriggerRule[],
  snapshots: PerformanceSnapshot[],
): TriggerEvaluation[] {
  return rules.map((rule) => evaluateTrigger(rule, snapshots))
}

export function resolveWaterfallState(
  evaluations: TriggerEvaluation[],
  arDate?: string,
): WaterfallStateType {
  if (arDate && Date.now() > new Date(arDate).getTime()) return 'POST_ARD'

  const breached = evaluations.filter((evaluation) => evaluation.status === 'BREACH')

  if (
    breached.some((evaluation) =>
      ['DSCR_EARLY_AMORTISATION', 'SERVICER_TERMINATION'].includes(evaluation.family),
    )
  ) {
    return 'EARLY_AMORTISATION'
  }

  const cashTrapFamilies = [
    'DSCR_CASH_TRAP',
    'DSCR_SENIOR_CASH_TRAP',
    'LTV_SWEEP',
    'OCCUPANCY_RESERVE',
    'WALT_CASH_TRAP',
    'TENANT_CONCENTRATION',
    'EXPENSE_RESERVE',
    'INTEREST_RESERVE',
  ]

  // PUE_EFFICIENCY and POWER_COST are surveillance-only families: they can
  // reach WATCH/BREACH status but never divert the waterfall.
  if (breached.some((evaluation) => cashTrapFamilies.includes(evaluation.family))) {
    return 'CASH_TRAP'
  }

  return 'NORMAL'
}
