import { describe, expect, it } from 'vitest'
import {
  SWITCH_DEAL_ID,
  demoDeals,
  demoEvaluations,
  demoEvaluationsForSnapshot,
  demoSnapshots,
  demoTriggerRules,
  toEvaluationRow,
} from './seedDemo'
import { evaluateAllTriggers } from '@/lib/engine/triggerEngine'

describe('seedDemo', () => {
  it('lets Postgres generate UUIDs for trigger evaluation rows', () => {
    const [evaluation] = demoEvaluations

    const row = toEvaluationRow(evaluation)

    expect(row.id).toBeUndefined()
    expect(row.rule_id).toBe(evaluation.ruleId)
    expect(row.snapshot_id).toBe(evaluation.snapshotId)
  })

  it('seeds a 5-deal corpus with 12 monthly snapshots each', () => {
    expect(demoDeals).toHaveLength(5)
    expect(new Set(demoDeals.map((deal) => deal.market)).size).toBe(5)
    for (const deal of demoDeals) {
      expect(demoSnapshots.filter((snapshot) => snapshot.dealId === deal.id)).toHaveLength(12)
      expect(demoTriggerRules.filter((rule) => rule.dealId === deal.id).length).toBeGreaterThanOrEqual(5)
    }
  })

  it('covers every expanded trigger family across the corpus', () => {
    const families = new Set(demoTriggerRules.map((rule) => rule.family))
    for (const family of [
      'DSCR_SENIOR_CASH_TRAP',
      'WALT_CASH_TRAP',
      'PUE_EFFICIENCY',
      'POWER_COST',
      'INTEREST_RESERVE',
      'OCCUPANCY_RESERVE',
      'TENANT_CONCENTRATION',
      'EXPENSE_RESERVE',
    ]) {
      expect(families).toContain(family)
    }
  })

  it('gives every demo deal a credible approved surveillance package', () => {
    for (const deal of demoDeals) {
      const approvedRules = demoTriggerRules.filter(
        (rule) => rule.dealId === deal.id && rule.extractionStatus === 'APPROVED',
      )
      const families = new Set(approvedRules.map((rule) => rule.family))
      const metricKeys = new Set(approvedRules.map((rule) => rule.metricKey))

      expect(approvedRules.length).toBeGreaterThanOrEqual(8)
      expect(families.size).toBeGreaterThanOrEqual(7)
      expect(metricKeys.has('dscr') || metricKeys.has('seniorDscr')).toBe(true)
      expect(metricKeys.has('ltv')).toBe(true)
      expect(
        ['occupancyRate', 'topTenantRevenuePct', 'weightedAvgRemainingLeaseTerm'].some((metric) =>
          metricKeys.has(metric),
        ),
      ).toBe(true)
    }
  })

  it('includes structured-finance consequences beyond simple DSCR monitoring', () => {
    const families = new Set(demoTriggerRules.map((rule) => rule.family))
    const consequences = new Set(demoTriggerRules.map((rule) => rule.consequence))

    for (const family of ['ADDITIONAL_ISSUANCE', 'ARD_MATURITY', 'SERVICER_TERMINATION']) {
      expect(families).toContain(family)
    }
    for (const consequence of [
      'ISSUANCE_BLOCKED',
      'TURBO_AMORTISATION',
      'MANAGER_REMOVAL',
      'RATE_STEP_UP',
      'MANDATORY_DELEVERAGING',
    ]) {
      expect(consequences).toContain(consequence)
    }
  })

  it('produces a varied latest monitoring picture across the portfolio', () => {
    const latestEvaluations = demoDeals.flatMap((deal) => {
      const latestSnapshot = demoSnapshots.filter((snapshot) => snapshot.dealId === deal.id).at(-1)
      return latestSnapshot ? demoEvaluationsForSnapshot(latestSnapshot.id) : []
    })
    const statuses = new Set(latestEvaluations.map((evaluation) => evaluation.status))

    expect(statuses).toContain('SAFE')
    expect(statuses).toContain('WATCH')
    expect(statuses).toContain('BREACH')
  })

  it('leaves 1-2 EXTRACTED drafts per deal for the analyst review demo', () => {
    for (const deal of demoDeals) {
      const drafts = demoTriggerRules.filter(
        (rule) => rule.dealId === deal.id && rule.extractionStatus === 'EXTRACTED',
      )
      expect(drafts.length).toBeGreaterThanOrEqual(1)
      expect(drafts.length).toBeLessThanOrEqual(2)
    }
  })

  it('calibrates the Phoenix deal so PUE and power cost sit in the WATCH zone', () => {
    const rules = demoTriggerRules.filter(
      (rule) =>
        rule.dealId === SWITCH_DEAL_ID &&
        (rule.family === 'PUE_EFFICIENCY' || rule.family === 'POWER_COST') &&
        rule.extractionStatus === 'APPROVED',
    )
    expect(rules).toHaveLength(2)

    const snapshots = demoSnapshots.filter((snapshot) => snapshot.dealId === SWITCH_DEAL_ID)
    const evaluations = evaluateAllTriggers(rules, snapshots)
    for (const evaluation of evaluations) {
      expect(evaluation.status).toBe('WATCH')
    }
  })
})
