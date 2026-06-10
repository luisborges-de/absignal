import { describe, expect, it } from 'vitest'
import {
  evaluateAllTriggers,
  evaluateTrigger,
  resolveWaterfallState,
} from './triggerEngine'
import type { PerformanceSnapshot } from '@/lib/types/performance'
import type { TriggerFamily, TriggerRule } from '@/lib/types/trigger'

const baseRule = (overrides: Partial<TriggerRule> = {}): TriggerRule => ({
  id: overrides.id ?? 'rule-dscr-cash-trap',
  dealId: 'demo-deal',
  family: overrides.family ?? 'DSCR_CASH_TRAP',
  name: overrides.name ?? 'DSCR Cash Trap',
  description: overrides.description ?? 'Three-month DSCR cash trap test',
  metricKey: overrides.metricKey ?? 'dscr',
  operator: overrides.operator ?? 'LT',
  threshold: overrides.threshold ?? 1.35,
  thresholdUnit: overrides.thresholdUnit ?? 'x',
  lookbackPeriods: overrides.lookbackPeriods ?? 3,
  consequence: overrides.consequence ?? 'CASH_TRAP',
  sectionReference: overrides.sectionReference ?? 'Section 3.14(b)(ii)',
  sourceText: overrides.sourceText ?? 'If the three-month rolling average DSCR falls below 1.35x.',
  extractionStatus: overrides.extractionStatus ?? 'APPROVED',
  extractionConfidence: overrides.extractionConfidence ?? 0.98,
  watchBuffer: overrides.watchBuffer ?? 0.1,
  active: overrides.active ?? true,
  createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2025-01-01T00:00:00.000Z',
})

const snapshot = (
  periodDate: string,
  overrides: Partial<PerformanceSnapshot> = {},
): PerformanceSnapshot => ({
  id: overrides.id ?? `snapshot-${periodDate}`,
  dealId: 'demo-deal',
  periodDate,
  occupancyRate: overrides.occupancyRate ?? 0.8,
  leasedCapacityMW: overrides.leasedCapacityMW ?? 388,
  totalCapacityMW: overrides.totalCapacityMW ?? 485,
  contractedRevenue: overrides.contractedRevenue ?? 12_000_000,
  grossRevenue: overrides.grossRevenue ?? 12_250_000,
  operatingExpenses: overrides.operatingExpenses ?? 4_000_000,
  netCashFlow: overrides.netCashFlow ?? 8_250_000,
  scheduledDebtService: overrides.scheduledDebtService ?? 6_000_000,
  seniorDebtService: overrides.seniorDebtService ?? 4_800_000,
  dscr: overrides.dscr ?? 1.4,
  seniorDscr: overrides.seniorDscr ?? 1.7,
  pueRatio: overrides.pueRatio ?? 1.25,
  powerCostPerKwh: overrides.powerCostPerKwh ?? 0.081,
  topTenantRevenuePct: overrides.topTenantRevenuePct ?? 0.31,
  tenantCount: overrides.tenantCount ?? 42,
  weightedAvgRemainingLeaseTerm: overrides.weightedAvgRemainingLeaseTerm ?? 3.1,
  outstandingBalance: overrides.outstandingBalance ?? 940_000_000,
  appraisedValue: overrides.appraisedValue ?? 1_540_000_000,
  ltv: overrides.ltv ?? 0.61,
  seniorInterestReserveBalance: overrides.seniorInterestReserveBalance ?? 20_000_000,
  expenseReserveBalance: overrides.expenseReserveBalance ?? 7_000_000,
  requiredReserveBalance: overrides.requiredReserveBalance ?? 6_000_000,
  source: overrides.source ?? 'DEMO',
  notes: overrides.notes ?? 'Synthetic surveillance snapshot',
  createdAt: overrides.createdAt ?? `${periodDate}T00:00:00.000Z`,
})

const snapshotsWithDscr = (values: number[]) =>
  values.map((dscr, index) =>
    snapshot(`2025-${String(index + 1).padStart(2, '0')}-28`, { dscr }),
  )

describe('triggerEngine', () => {
  it('fires DSCR cash trap at a 3m average exactly equal to 1.35x for an LTE boundary rule', () => {
    const result = evaluateTrigger(baseRule({ operator: 'LTE' }), snapshotsWithDscr([1.35, 1.35, 1.35]))

    expect(result.status).toBe('BREACH')
    expect(result.currentValue).toBeCloseTo(1.35, 4)
  })

  it('does not fire DSCR cash trap at a 3m average of 1.36x', () => {
    const result = evaluateTrigger(baseRule(), snapshotsWithDscr([1.36, 1.36, 1.36]))

    expect(result.status).toBe('WATCH')
    expect(result.distanceToBreachPct).toBeCloseTo((1.36 - 1.35) / 1.35, 4)
  })

  it('returns WATCH at 1.40x when threshold is 1.35x and watchBuffer is 0.10', () => {
    const result = evaluateTrigger(baseRule(), snapshotsWithDscr([1.4, 1.4, 1.4]))

    expect(result.status).toBe('WATCH')
  })

  it('returns SAFE at 1.50x with the same DSCR cash trap config', () => {
    const result = evaluateTrigger(baseRule(), snapshotsWithDscr([1.5, 1.5, 1.5]))

    expect(result.status).toBe('SAFE')
  })

  it('computes the 3-period rolling average from the most recent 3 snapshots', () => {
    const result = evaluateTrigger(baseRule(), snapshotsWithDscr([1.8, 1.2, 1.3, 1.4]))

    expect(result.currentValue).toBeCloseTo(1.3, 4)
    expect(result.lookbackValues).toEqual([1.2, 1.3, 1.4])
  })

  it('fires an occupancy LT trigger correctly', () => {
    const result = evaluateTrigger(
      baseRule({
        family: 'OCCUPANCY_RESERVE',
        metricKey: 'occupancyRate',
        lookbackPeriods: 1,
        threshold: 0.75,
        consequence: 'ENHANCED_RESERVE',
        watchBuffer: 0.05,
      }),
      [snapshot('2025-10-31', { occupancyRate: 0.74 })],
    )

    expect(result.status).toBe('BREACH')
  })

  it('fires a GT trigger for LTV sweep and signs distanceToBreachPct as negative when breached', () => {
    const result = evaluateTrigger(
      baseRule({
        family: 'LTV_SWEEP',
        metricKey: 'ltv',
        operator: 'GT',
        lookbackPeriods: 1,
        threshold: 0.65,
        consequence: 'MANDATORY_DELEVERAGING',
        watchBuffer: 0.08,
      }),
      [snapshot('2025-10-31', { ltv: 0.67 })],
    )

    expect(result.status).toBe('BREACH')
    expect(result.distanceToBreachPct).toBeLessThan(0)
  })

  it('resolves CASH_TRAP when DSCR_CASH_TRAP fires', () => {
    const [evaluation] = evaluateAllTriggers([baseRule()], snapshotsWithDscr([1.26, 1.26, 1.26]))

    expect(resolveWaterfallState([evaluation])).toBe('CASH_TRAP')
  })

  it('resolves EARLY_AMORTISATION as higher priority than CASH_TRAP', () => {
    const cashTrap = evaluateTrigger(baseRule(), snapshotsWithDscr([1.2, 1.2, 1.2]))
    const earlyAmortisation = evaluateTrigger(
      baseRule({
        id: 'early-amortisation',
        family: 'DSCR_EARLY_AMORTISATION',
        threshold: 1.1,
        consequence: 'EARLY_AMORTISATION',
      }),
      snapshotsWithDscr([1.0, 1.0, 1.0]),
    )

    expect(resolveWaterfallState([cashTrap, earlyAmortisation])).toBe('EARLY_AMORTISATION')
  })

  it('returns N/A when only 1 snapshot is available and lookback is 3', () => {
    const result = evaluateTrigger(baseRule(), [snapshot('2025-01-31', { dscr: 1.1 })])

    expect(result.status).toBe('N/A')
  })

  it('returns N/A for inactive rules and for missing metrics', () => {
    expect(evaluateTrigger(baseRule({ active: false }), snapshotsWithDscr([1.1, 1.1, 1.1])).status).toBe(
      'N/A',
    )
    expect(
      evaluateTrigger(baseRule({ metricKey: 'missingMetric' }), snapshotsWithDscr([1.1, 1.1, 1.1]))
        .status,
    ).toBe('N/A')
  })

  it('handles GTE, EQ, and BINARY operators', () => {
    expect(
      evaluateTrigger(
        baseRule({ operator: 'GTE', threshold: 0.65, metricKey: 'ltv', lookbackPeriods: 1 }),
        [snapshot('2025-10-31', { ltv: 0.65 })],
      ).status,
    ).toBe('BREACH')

    expect(
      evaluateTrigger(
        baseRule({ operator: 'EQ', threshold: 0.8, metricKey: 'occupancyRate', lookbackPeriods: 1 }),
        [snapshot('2025-10-31', { occupancyRate: 0.8 })],
      ).status,
    ).toBe('BREACH')

    expect(
      evaluateTrigger(
        baseRule({ operator: 'BINARY', threshold: null, metricKey: 'tenantCount', lookbackPeriods: 1 }),
        [snapshot('2025-10-31', { tenantCount: 1 })],
      ).status,
    ).toBe('BREACH')
  })

  it('resolves POST_ARD above all trigger states when the ARD has passed', () => {
    const [evaluation] = evaluateAllTriggers([baseRule()], snapshotsWithDscr([1.0, 1.0, 1.0]))

    expect(resolveWaterfallState([evaluation], '2000-01-01')).toBe('POST_ARD')
  })

  it('covers all trigger families across evaluation cases', () => {
    const families: TriggerFamily[] = [
      'DSCR_CASH_TRAP',
      'DSCR_EARLY_AMORTISATION',
      'DSCR_SENIOR_CASH_TRAP',
      'LTV_SWEEP',
      'OCCUPANCY_RESERVE',
      'TENANT_CONCENTRATION',
      'WART_RESERVE',
      'WALT_CASH_TRAP',
      'PUE_EFFICIENCY',
      'POWER_COST',
      'SERVICER_TERMINATION',
      'ADDITIONAL_ISSUANCE',
      'ARD_MATURITY',
      'EXPENSE_RESERVE',
      'INTEREST_RESERVE',
    ]

    const rules = families.map((family, index) =>
      baseRule({
        id: `rule-${family}`,
        family,
        lookbackPeriods: 1,
        metricKey: index % 2 === 0 ? 'dscr' : 'occupancyRate',
        operator: index % 2 === 0 ? 'LT' : 'GT',
        threshold: index % 2 === 0 ? 1.35 : 0.75,
      }),
    )

    const results = evaluateAllTriggers(rules, [snapshot('2025-10-31', { dscr: 1.5, occupancyRate: 0.8 })])

    expect(new Set(results.map((result) => result.family))).toEqual(new Set(families))
  })

  describe('expanded trigger families', () => {
    it('fires OCCUPANCY_RESERVE below threshold and resolves CASH_TRAP', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'OCCUPANCY_RESERVE',
          metricKey: 'occupancyRate',
          operator: 'LT',
          threshold: 0.75,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { occupancyRate: 0.7 })],
      )

      expect(result.status).toBe('BREACH')
      expect(resolveWaterfallState([result])).toBe('CASH_TRAP')
    })

    it('fires WALT_CASH_TRAP below threshold and resolves CASH_TRAP', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'WALT_CASH_TRAP',
          metricKey: 'weightedAvgRemainingLeaseTerm',
          operator: 'LT',
          threshold: 2.5,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { weightedAvgRemainingLeaseTerm: 2.1 })],
      )

      expect(result.status).toBe('BREACH')
      expect(resolveWaterfallState([result])).toBe('CASH_TRAP')
    })

    it('fires TENANT_CONCENTRATION above threshold and resolves CASH_TRAP', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'TENANT_CONCENTRATION',
          metricKey: 'topTenantRevenuePct',
          operator: 'GT',
          threshold: 0.4,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { topTenantRevenuePct: 0.45 })],
      )

      expect(result.status).toBe('BREACH')
      expect(resolveWaterfallState([result])).toBe('CASH_TRAP')
    })

    it('fires EXPENSE_RESERVE below threshold and resolves CASH_TRAP', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'EXPENSE_RESERVE',
          metricKey: 'expenseReserveBalance',
          operator: 'LT',
          threshold: 6_000_000,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { expenseReserveBalance: 5_400_000 })],
      )

      expect(result.status).toBe('BREACH')
      expect(resolveWaterfallState([result])).toBe('CASH_TRAP')
    })

    it('fires INTEREST_RESERVE below threshold and resolves CASH_TRAP', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'INTEREST_RESERVE',
          metricKey: 'seniorInterestReserveBalance',
          operator: 'LT',
          threshold: 18_000_000,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { seniorInterestReserveBalance: 15_000_000 })],
      )

      expect(result.status).toBe('BREACH')
      expect(resolveWaterfallState([result])).toBe('CASH_TRAP')
    })

    it('fires DSCR_SENIOR_CASH_TRAP below threshold and resolves CASH_TRAP', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'DSCR_SENIOR_CASH_TRAP',
          metricKey: 'seniorDscr',
          operator: 'LT',
          threshold: 1.5,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { seniorDscr: 1.4 })],
      )

      expect(result.status).toBe('BREACH')
      expect(resolveWaterfallState([result])).toBe('CASH_TRAP')
    })

    it('evaluates PUE_EFFICIENCY into WATCH near the threshold', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'PUE_EFFICIENCY',
          metricKey: 'pueRatio',
          operator: 'GT',
          threshold: 1.4,
          lookbackPeriods: 1,
          watchBuffer: 0.1,
        }),
        [snapshot('2025-10-31', { pueRatio: 1.36 })],
      )

      expect(result.status).toBe('WATCH')
    })

    it('evaluates POWER_COST into WATCH near the threshold', () => {
      const result = evaluateTrigger(
        baseRule({
          family: 'POWER_COST',
          metricKey: 'powerCostPerKwh',
          operator: 'GT',
          threshold: 0.095,
          lookbackPeriods: 1,
          watchBuffer: 0.1,
        }),
        [snapshot('2025-10-31', { powerCostPerKwh: 0.092 })],
      )

      expect(result.status).toBe('WATCH')
    })

    it('never changes waterfall state for PUE_EFFICIENCY or POWER_COST even on BREACH', () => {
      const pueBreach = evaluateTrigger(
        baseRule({
          family: 'PUE_EFFICIENCY',
          metricKey: 'pueRatio',
          operator: 'GT',
          threshold: 1.4,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { pueRatio: 1.55 })],
      )
      const powerBreach = evaluateTrigger(
        baseRule({
          family: 'POWER_COST',
          metricKey: 'powerCostPerKwh',
          operator: 'GT',
          threshold: 0.095,
          lookbackPeriods: 1,
        }),
        [snapshot('2025-10-31', { powerCostPerKwh: 0.12 })],
      )

      expect(pueBreach.status).toBe('BREACH')
      expect(powerBreach.status).toBe('BREACH')
      expect(resolveWaterfallState([pueBreach, powerBreach])).toBe('NORMAL')
    })
  })
})
