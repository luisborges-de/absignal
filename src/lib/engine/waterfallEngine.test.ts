import { describe, expect, it } from 'vitest'
import { buildWaterfallSummary } from './waterfallEngine'

describe('waterfallEngine', () => {
  it('keeps all layers open in NORMAL state', () => {
    const summary = buildWaterfallSummary('NORMAL', 1.5)

    expect(summary.dscr).toBe(1.5)
    expect(summary.layers).toHaveLength(5)
    expect(summary.layers.every((layer) => !layer.blocked)).toBe(true)
  })

  it('blocks Class B and Residual in CASH_TRAP state', () => {
    const summary = buildWaterfallSummary('CASH_TRAP', 1.19)

    expect(summary.layers.filter((layer) => layer.blocked).map((layer) => layer.id)).toEqual([
      'class-b',
      'residual',
    ])
  })
})
