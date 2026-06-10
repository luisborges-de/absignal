import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCreditImpactPreview,
  fetchGridSignals,
  fetchProviderSignals,
  normalizeViaNexusSignals,
  normalizeWeatherSignals,
} from './liveSignals'
import { demoSnapshots } from '@/lib/demo/seedDemo'
import { MARKETS } from '@/lib/live-signals/markets'

describe('liveSignals', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('normalizes NWS-shaped weather observations into credit-relevant signals', () => {
    const signals = normalizeWeatherSignals(
      {
        properties: {
          timestamp: '2026-06-09T18:00:00Z',
          temperature: { value: 36 },
          heatIndex: { value: 39 },
        },
      },
      {
        features: [{ properties: { event: 'Severe Thunderstorm Warning' } }],
      },
    )

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'NWS',
          label: 'Ashburn heat index',
          value: 102.2,
          unit: 'F',
          severity: 'STRESS',
        }),
        expect.objectContaining({
          provider: 'NWS',
          label: 'Weather alert',
          value: 1,
          unit: 'active alerts',
          severity: 'WATCH',
        }),
      ]),
    )
  })

  it('normalizes ViaNexus quote and profile data into market-intelligence signals', () => {
    const signals = normalizeViaNexusSignals(
      [
        {
          symbol: 'EQIX',
          companyName: 'Equinix Inc.',
          changePercent: -0.0412,
          delayedPrice: 1005.2,
          currency: 'USD',
        },
      ],
      [{ symbol: 'EQIX', cik: '0001101239', filingDate: '2026-02-11' }],
      '2026-06-09T18:00:00Z',
    )

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'VIANEXUS',
          label: 'EQIX market move',
          value: -4.12,
          unit: '%',
          severity: 'WATCH',
        }),
        expect.objectContaining({
          provider: 'VIANEXUS',
          label: 'Operator intelligence coverage',
          value: 1,
          unit: 'profiles',
          severity: 'INFO',
        }),
      ]),
    )
  })

  it('builds a credit-impact preview from proxy stress signals', () => {
    const latestSnapshot = demoSnapshots.at(-1)
    if (!latestSnapshot) throw new Error('Expected demo snapshot')

    const preview = buildCreditImpactPreview(
      latestSnapshot,
      [
        {
          provider: 'NWS',
          label: 'Ashburn heat index',
          value: 102,
          unit: 'F',
          severity: 'STRESS',
          observedAt: '2026-06-09T18:00:00Z',
        },
        {
          provider: 'EIA',
          label: 'PJM grid demand',
          value: 150000,
          unit: 'MW',
          severity: 'WATCH',
          observedAt: '2026-06-09T18:00:00Z',
        },
      ],
      new Date('2026-06-09T18:00:00Z'),
    )

    expect(preview.estimatedDscr).toBeLessThan(latestSnapshot.dscr)
    expect(preview.scenarioSnapshot?.notes).toContain('Generated from live proxy signals')
    expect(preview.changedMetrics.map((metric) => metric.metric)).toEqual(
      expect.arrayContaining(['pueRatio', 'powerCostPerKwh', 'operatingExpenses', 'netCashFlow', 'dscr']),
    )
  })

  it('attaches a scenario snapshot with server-computed ratios for client-side evaluation', () => {
    const latestSnapshot = demoSnapshots.at(-1)
    if (!latestSnapshot) throw new Error('Expected demo snapshot')

    const preview = buildCreditImpactPreview(
      latestSnapshot,
      [
        {
          provider: 'EIA',
          label: 'ERCOT grid demand',
          value: 82_000,
          unit: 'MW',
          severity: 'STRESS',
          observedAt: '2026-06-09T18:00:00Z',
        },
      ],
      new Date('2026-06-09T18:00:00Z'),
    )

    const scenario = preview.scenarioEvaluationSnapshot
    expect(scenario).toBeDefined()
    expect(scenario?.dealId).toBe(latestSnapshot.dealId)
    expect(scenario?.dscr).toBe(preview.estimatedDscr)
    expect(scenario?.seniorDscr).toBeGreaterThan(0)
    expect(scenario?.ltv).toBeGreaterThan(0)
  })

  it('returns partial provider results when one provider fails', async () => {
    const providers = [
      () => Promise.resolve([{ provider: 'NWS' as const, signals: [], status: 'ok' as const }]),
      () => Promise.reject(new Error('Grid provider failed')),
    ]

    const result = await fetchProviderSignals(providers)

    expect(result.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'NWS', status: 'ok' }),
        expect.objectContaining({ provider: 'UNKNOWN', status: 'error' }),
      ]),
    )
  })

  it('normalizes EIA hourly periods that omit minutes', async () => {
    vi.stubEnv('EIA_API_KEY', 'test-eia-key')
    vi.stubGlobal('fetch', async () =>
      Response.json({
        response: {
          data: [
            {
              period: '2026-06-10T12',
              value: '23281',
            },
          ],
        },
      }),
    )

    const result = await fetchGridSignals(MARKETS.SILICON_VALLEY)

    expect(result.status).toBe('ok')
    expect(result.signals[0]).toEqual(
      expect.objectContaining({
        provider: 'EIA',
        label: 'CAISO grid demand',
        value: 23281,
        observedAt: '2026-06-10T12:00:00.000Z',
      }),
    )
  })
})
