export interface RatioInputs {
  netCashFlow: number
  scheduledDebtService: number
  seniorDebtService: number
  outstandingBalance: number
  appraisedValue: number
}

export interface ComputedRatios {
  dscr: number
  seniorDscr: number
  ltv: number
}

/** Single source of truth for derived credit ratios (4dp, matching snapshot persistence). */
export function computeRatios(input: RatioInputs): ComputedRatios {
  const dscr = input.scheduledDebtService > 0 ? input.netCashFlow / input.scheduledDebtService : 0
  const seniorDscr = input.seniorDebtService > 0 ? input.netCashFlow / input.seniorDebtService : 0
  const ltv = input.appraisedValue > 0 ? input.outstandingBalance / input.appraisedValue : 0

  return {
    dscr: Math.round(dscr * 10_000) / 10_000,
    seniorDscr: Math.round(seniorDscr * 10_000) / 10_000,
    ltv: Math.round(ltv * 10_000) / 10_000,
  }
}
