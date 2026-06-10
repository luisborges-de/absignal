import { describe, expect, it } from 'vitest'
import { createEvaluationChannelTopic } from './useEvaluations'

describe('createEvaluationChannelTopic', () => {
  it('creates a unique realtime topic for repeated evaluation subscriptions on the same deal', () => {
    const dealId = 'a1b2c3d4-0000-0000-0000-ce47e53a4a2e'

    const firstTopic = createEvaluationChannelTopic(dealId)
    const secondTopic = createEvaluationChannelTopic(dealId)

    expect(firstTopic).toMatch(`evaluations:${dealId}:`)
    expect(secondTopic).toMatch(`evaluations:${dealId}:`)
    expect(secondTopic).not.toBe(firstTopic)
  })
})
