import { addLocalSnapshot, getLocalSnapshots } from '@/lib/demo/localStore'
import { DEMO_DEAL_ID } from '@/lib/demo/seedDemo'
import { computeRatios } from '@/lib/engine/ratios'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { mapSnapshot } from './mappers'
import type { PerformanceSnapshot, PerformanceSnapshotInput } from '@/lib/types/performance'

function id() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function withComputedRatios(dealId: string, input: PerformanceSnapshotInput): PerformanceSnapshot {
  return {
    ...input,
    id: id(),
    dealId,
    ...computeRatios(input),
    source: input.source ?? 'MANUAL',
    createdAt: new Date().toISOString(),
  }
}

function toSnapshotRow(snapshot: PerformanceSnapshot) {
  return {
    id: snapshot.id,
    deal_id: snapshot.dealId,
    period_date: snapshot.periodDate,
    occupancy_rate: snapshot.occupancyRate,
    leased_capacity_mw: snapshot.leasedCapacityMW,
    total_capacity_mw: snapshot.totalCapacityMW,
    contracted_revenue: snapshot.contractedRevenue,
    gross_revenue: snapshot.grossRevenue,
    operating_expenses: snapshot.operatingExpenses,
    net_cash_flow: snapshot.netCashFlow,
    scheduled_debt_service: snapshot.scheduledDebtService,
    senior_debt_service: snapshot.seniorDebtService,
    dscr: snapshot.dscr,
    senior_dscr: snapshot.seniorDscr,
    ltv: snapshot.ltv,
    pue_ratio: snapshot.pueRatio,
    power_cost_per_kwh: snapshot.powerCostPerKwh,
    top_tenant_revenue_pct: snapshot.topTenantRevenuePct,
    tenant_count: snapshot.tenantCount,
    weighted_avg_remaining_lease_term: snapshot.weightedAvgRemainingLeaseTerm,
    outstanding_balance: snapshot.outstandingBalance,
    appraised_value: snapshot.appraisedValue,
    senior_interest_reserve_balance: snapshot.seniorInterestReserveBalance,
    expense_reserve_balance: snapshot.expenseReserveBalance,
    required_reserve_balance: snapshot.requiredReserveBalance,
    source: snapshot.source,
    notes: snapshot.notes,
  }
}

export async function getSnapshots(dealId = DEMO_DEAL_ID) {
  if (!isSupabaseConfigured()) return getLocalSnapshots(dealId)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('performance_snapshots')
    .select('*')
    .eq('deal_id', dealId)
    .order('period_date', { ascending: true })

  if (error) throw error
  return data.map(mapSnapshot)
}

export async function createSnapshot({
  dealId,
  input,
}: {
  dealId: string
  input: PerformanceSnapshotInput
}) {
  const snapshot = withComputedRatios(dealId, input)

  if (!isSupabaseConfigured()) return addLocalSnapshot(snapshot)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('performance_snapshots')
    .upsert(toSnapshotRow(snapshot), { onConflict: 'deal_id,period_date' })
    .select('*')
    .single()

  if (error) throw error
  return mapSnapshot(data)
}
