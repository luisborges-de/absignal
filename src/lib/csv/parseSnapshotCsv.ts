import type { PerformanceSnapshotInput } from '@/lib/types/performance'

/** Expected CSV headers map 1:1 to PerformanceSnapshotInput fields (snake_case). */
export const SNAPSHOT_CSV_HEADER_MAP: Record<string, keyof PerformanceSnapshotInput> = {
  period_date: 'periodDate',
  occupancy_rate: 'occupancyRate',
  leased_capacity_mw: 'leasedCapacityMW',
  total_capacity_mw: 'totalCapacityMW',
  contracted_revenue: 'contractedRevenue',
  gross_revenue: 'grossRevenue',
  operating_expenses: 'operatingExpenses',
  net_cash_flow: 'netCashFlow',
  scheduled_debt_service: 'scheduledDebtService',
  senior_debt_service: 'seniorDebtService',
  pue_ratio: 'pueRatio',
  power_cost_per_kwh: 'powerCostPerKwh',
  top_tenant_revenue_pct: 'topTenantRevenuePct',
  tenant_count: 'tenantCount',
  weighted_avg_remaining_lease_term: 'weightedAvgRemainingLeaseTerm',
  outstanding_balance: 'outstandingBalance',
  appraised_value: 'appraisedValue',
  senior_interest_reserve_balance: 'seniorInterestReserveBalance',
  expense_reserve_balance: 'expenseReserveBalance',
  required_reserve_balance: 'requiredReserveBalance',
}

export function parseSnapshotCsv(text: string): PerformanceSnapshotInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row.')

  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase())
  if (!headers.includes('period_date')) {
    throw new Error('CSV must include a period_date column. Download the template for the expected format.')
  }

  return lines.slice(1).map((line, rowIndex) => {
    const cells = line.split(',').map((cell) => cell.trim())
    const row: Record<string, string | number> = {}

    headers.forEach((header, index) => {
      const field = SNAPSHOT_CSV_HEADER_MAP[header]
      if (!field) return
      const raw = cells[index] ?? ''
      if (field === 'periodDate') {
        row[field] = raw
        return
      }
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        throw new Error(`Row ${rowIndex + 2}: "${raw}" is not a number for ${header}.`)
      }
      row[field] = value
    })

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.periodDate ?? ''))) {
      throw new Error(`Row ${rowIndex + 2}: period_date must be YYYY-MM-DD.`)
    }

    return {
      notes: 'Imported from CSV',
      source: 'CSV_IMPORT',
      ...row,
    } as unknown as PerformanceSnapshotInput
  })
}
