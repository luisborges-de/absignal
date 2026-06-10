import { describe, expect, it } from 'vitest'
import { computeRatios } from './ratios'

describe('computeRatios', () => {
  it('computes dscr, seniorDscr, and ltv rounded to 4dp', () => {
    const ratios = computeRatios({
      netCashFlow: 8_250_000,
      scheduledDebtService: 6_000_000,
      seniorDebtService: 4_800_000,
      outstandingBalance: 940_000_000,
      appraisedValue: 1_540_000_000,
    })

    expect(ratios.dscr).toBeCloseTo(1.375, 4)
    expect(ratios.seniorDscr).toBeCloseTo(1.7188, 4)
    expect(ratios.ltv).toBeCloseTo(0.6104, 4)
  })

  it('returns zero ratios when denominators are zero', () => {
    const ratios = computeRatios({
      netCashFlow: 1_000_000,
      scheduledDebtService: 0,
      seniorDebtService: 0,
      outstandingBalance: 100,
      appraisedValue: 0,
    })

    expect(ratios).toEqual({ dscr: 0, seniorDscr: 0, ltv: 0 })
  })
})
