import { describe, expect, it } from 'vitest'
import { parseSnapshotCsv } from '@/lib/csv/parseSnapshotCsv'

const HEADER =
  'period_date,occupancy_rate,leased_capacity_mw,total_capacity_mw,contracted_revenue,gross_revenue,operating_expenses,net_cash_flow,scheduled_debt_service,senior_debt_service,pue_ratio,power_cost_per_kwh,top_tenant_revenue_pct,tenant_count,weighted_avg_remaining_lease_term,outstanding_balance,appraised_value,senior_interest_reserve_balance,expense_reserve_balance,required_reserve_balance'

const ROW =
  '2025-01-31,0.87,421.95,485,12000000,12300000,4000000,8520000,6000000,4800000,1.25,0.081,0.28,42,3.2,940000000,1593220339,20000000,7800000,6000000'

describe('parseSnapshotCsv', () => {
  it('maps snake_case headers to PerformanceSnapshotInput fields', () => {
    const [row] = parseSnapshotCsv(`${HEADER}\n${ROW}`)

    expect(row.periodDate).toBe('2025-01-31')
    expect(row.occupancyRate).toBe(0.87)
    expect(row.leasedCapacityMW).toBe(421.95)
    expect(row.powerCostPerKwh).toBe(0.081)
    expect(row.weightedAvgRemainingLeaseTerm).toBe(3.2)
    expect(row.requiredReserveBalance).toBe(6_000_000)
    expect(row.source).toBe('CSV_IMPORT')
  })

  it('parses the shipped sample CSV format with multiple rows', () => {
    const rows = parseSnapshotCsv(`${HEADER}\n${ROW}\n${ROW.replace('2025-01-31', '2025-02-28')}`)

    expect(rows).toHaveLength(2)
    expect(rows[1].periodDate).toBe('2025-02-28')
  })

  it('rejects CSVs without the period_date column', () => {
    expect(() => parseSnapshotCsv('foo,bar\n1,2')).toThrow(/period_date/)
  })

  it('rejects non-numeric metric values with a row reference', () => {
    expect(() => parseSnapshotCsv(`${HEADER}\n${ROW.replace('0.87', 'abc')}`)).toThrow(/Row 2/)
  })

  it('rejects malformed period dates', () => {
    expect(() => parseSnapshotCsv(`${HEADER}\n${ROW.replace('2025-01-31', '01/31/2025')}`)).toThrow(
      /YYYY-MM-DD/,
    )
  })
})
