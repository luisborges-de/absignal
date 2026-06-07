import { describe, expect, it } from 'vitest'
import { demoEvaluations, toEvaluationRow } from './seedDemo'

describe('seedDemo', () => {
  it('lets Postgres generate UUIDs for trigger evaluation rows', () => {
    const [evaluation] = demoEvaluations

    const row = toEvaluationRow(evaluation)

    expect(row.id).toBeUndefined()
    expect(row.rule_id).toBe(evaluation.ruleId)
    expect(row.snapshot_id).toBe(evaluation.snapshotId)
  })
})
