import type { Deal } from '@/lib/types/deal'
import type { PerformanceSnapshot } from '@/lib/types/performance'
import type { TriggerEvaluation, TriggerRule } from '@/lib/types/trigger'
import type { Database, Json } from '@/lib/supabase/types'

type DealRow = Database['public']['Tables']['deals']['Row']
type RuleRow = Database['public']['Tables']['trigger_rules']['Row']
type SnapshotRow = Database['public']['Tables']['performance_snapshots']['Row']
type EvaluationRow = Database['public']['Tables']['trigger_evaluations']['Row']

function n(value: number | null | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function s(value: string | null | undefined, fallback = '') {
  return value ?? fallback
}

function jsonToNumberArray(value: Json | null | undefined) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === 'number')
}

export function mapDeal(row: DealRow): Deal {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    issuer: row.issuer,
    closingDate: row.closing_date,
    arDate: row.ar_date,
    totalIssuance: row.total_issuance,
    assetCount: row.asset_count,
    collateralDescription: s(row.collateral_description),
    ratingAgency: s(row.rating_agency),
    rating: s(row.rating),
    ltv: n(row.ltv),
    isDemo: Boolean(row.is_demo),
    status: row.status,
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at),
  }
}

export function mapTriggerRule(row: RuleRow): TriggerRule {
  return {
    id: row.id,
    dealId: row.deal_id,
    family: row.family,
    name: row.name,
    description: s(row.description),
    metricKey: row.metric_key,
    operator: row.operator,
    threshold: row.threshold,
    thresholdUnit: s(row.threshold_unit),
    lookbackPeriods: row.lookback_periods,
    consequence: row.consequence,
    sectionReference: s(row.section_reference),
    sourceText: s(row.source_text),
    extractionStatus: row.extraction_status,
    extractionConfidence: n(row.extraction_confidence),
    watchBuffer: n(row.watch_buffer, 0.1),
    active: Boolean(row.active),
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at),
  }
}

export function mapSnapshot(row: SnapshotRow): PerformanceSnapshot {
  return {
    id: row.id,
    dealId: row.deal_id,
    periodDate: row.period_date,
    occupancyRate: n(row.occupancy_rate),
    leasedCapacityMW: n(row.leased_capacity_mw),
    totalCapacityMW: n(row.total_capacity_mw),
    contractedRevenue: n(row.contracted_revenue),
    grossRevenue: n(row.gross_revenue),
    operatingExpenses: n(row.operating_expenses),
    netCashFlow: n(row.net_cash_flow),
    scheduledDebtService: n(row.scheduled_debt_service),
    seniorDebtService: n(row.senior_debt_service),
    dscr: n(row.dscr),
    seniorDscr: n(row.senior_dscr),
    pueRatio: n(row.pue_ratio),
    powerCostPerKwh: n(row.power_cost_per_kwh),
    topTenantRevenuePct: n(row.top_tenant_revenue_pct),
    tenantCount: n(row.tenant_count),
    weightedAvgRemainingLeaseTerm: n(row.weighted_avg_remaining_lease_term),
    outstandingBalance: n(row.outstanding_balance),
    appraisedValue: n(row.appraised_value),
    ltv: n(row.ltv),
    seniorInterestReserveBalance: n(row.senior_interest_reserve_balance),
    expenseReserveBalance: n(row.expense_reserve_balance),
    requiredReserveBalance: n(row.required_reserve_balance),
    source: row.source ?? 'MANUAL',
    notes: s(row.notes),
    createdAt: s(row.created_at),
  }
}

export function mapEvaluation(row: EvaluationRow, rule: TriggerRule): TriggerEvaluation {
  return {
    id: row.id,
    ruleId: row.rule_id,
    snapshotId: row.snapshot_id,
    family: rule.family,
    consequence: rule.consequence,
    status: row.status,
    currentValue: row.current_value,
    threshold: row.threshold,
    distanceToBreachPct: row.distance_to_breach_pct,
    lookbackValues: jsonToNumberArray(row.lookback_values),
    evaluatedAt: s(row.evaluated_at),
  }
}
