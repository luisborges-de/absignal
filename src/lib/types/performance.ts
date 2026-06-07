export interface PerformanceSnapshot {
  id: string
  dealId: string
  periodDate: string
  occupancyRate: number
  leasedCapacityMW: number
  totalCapacityMW: number
  contractedRevenue: number
  grossRevenue: number
  operatingExpenses: number
  netCashFlow: number
  scheduledDebtService: number
  seniorDebtService: number
  dscr: number
  seniorDscr: number
  pueRatio: number
  powerCostPerKwh: number
  topTenantRevenuePct: number
  tenantCount: number
  weightedAvgRemainingLeaseTerm: number
  outstandingBalance: number
  appraisedValue: number
  ltv: number
  seniorInterestReserveBalance: number
  expenseReserveBalance: number
  requiredReserveBalance: number
  source: 'MANUAL' | 'CSV_IMPORT' | 'DEMO'
  notes: string
  createdAt: string
}

export type PerformanceSnapshotInput = Omit<
  PerformanceSnapshot,
  'id' | 'dealId' | 'dscr' | 'seniorDscr' | 'ltv' | 'source' | 'createdAt'
> & {
  source?: 'MANUAL' | 'CSV_IMPORT' | 'DEMO'
}
