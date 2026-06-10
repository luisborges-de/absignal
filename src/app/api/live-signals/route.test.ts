import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { DEMO_DEAL_ID } from '@/lib/demo/seedDemo'

describe('GET /api/live-signals', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns partial live proxy data without optional provider keys', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://your-project.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'your-publishable-key')
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/observations/latest')) {
        return Response.json({
          properties: {
            timestamp: '2026-06-09T18:00:00Z',
            temperature: { value: 32 },
            heatIndex: { value: 33 },
          },
        })
      }

      return Response.json({ features: [] })
    })

    const response = await GET(new Request(`http://localhost/api/live-signals?dealId=${DEMO_DEAL_ID}`))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.signals.length).toBeGreaterThan(0)
    expect(body.providerStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'NWS', status: 'ok' }),
        expect.objectContaining({ provider: 'EIA', status: 'skipped' }),
        expect.objectContaining({ provider: 'VIANEXUS', status: 'skipped' }),
      ]),
    )
    expect(body.canApplySnapshot).toBe(true)
  })

  it('does not expose server-side provider tokens', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://your-project.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'your-publishable-key')
    vi.stubEnv('EIA_API_KEY', 'secret-eia-token')
    vi.stubEnv('VIANEXUS_API_TOKEN', 'secret-vianexus-token')
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('/observations/latest')) {
        return Response.json({
          properties: {
            timestamp: '2026-06-09T18:00:00Z',
            temperature: { value: 32 },
          },
        })
      }
      if (url.includes('api.eia.gov')) {
        return Response.json({ response: { data: [{ period: '2026-06-09T18', value: 150000 }] } })
      }
      if (url.includes('CORE/QUOTE/EQIX')) {
        return Response.json([
          {
            symbol: 'EQIX',
            companyName: 'Equinix Inc.',
            changePercent: -0.012,
            delayedPrice: 1012,
            currency: 'USD',
          },
        ])
      }
      if (url.includes('CORE/QUOTE/DLR')) {
        return Response.json([
          {
            symbol: 'DLR',
            companyName: 'Digital Realty Trust Inc.',
            changePercent: 0.008,
            delayedPrice: 184,
            currency: 'USD',
          },
        ])
      }
      if (url.includes('CORE/COMPANY_DESCRIPTIONS/EQIX')) {
        return Response.json([{ symbol: 'EQIX', cik: '0001101239' }])
      }
      if (url.includes('CORE/COMPANY_DESCRIPTIONS/DLR')) {
        return Response.json([{ symbol: 'DLR', cik: '0001297996' }])
      }

      return Response.json({ features: [] })
    })

    const response = await GET(new Request(`http://localhost/api/live-signals?dealId=${DEMO_DEAL_ID}`))
    const serialized = JSON.stringify(await response.json())

    expect(response.status).toBe(200)
    expect(serialized).not.toContain('secret-eia-token')
    expect(serialized).not.toContain('secret-vianexus-token')
  })
})
