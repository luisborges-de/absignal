import { describe, expect, it } from 'vitest'
import { MARKETS, getMarketConfig } from './markets'
import { DEAL_MARKETS } from '@/lib/types/deal'

describe('markets', () => {
  it('defines a config for every deal market', () => {
    for (const market of DEAL_MARKETS) {
      const config = MARKETS[market]
      expect(config.market).toBe(market)
      expect(config.nwsStationId).toMatch(/^K[A-Z]{3}$/)
      expect(config.nwsAlertPoint).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/)
      expect(config.eiaRespondent.length).toBeGreaterThan(0)
    }
  })

  it('falls back to Northern Virginia for unknown or missing markets', () => {
    expect(getMarketConfig('PHOENIX').market).toBe('PHOENIX')
    expect(getMarketConfig('MARS').market).toBe('NORTHERN_VIRGINIA')
    expect(getMarketConfig(null).market).toBe('NORTHERN_VIRGINIA')
    expect(getMarketConfig(undefined).market).toBe('NORTHERN_VIRGINIA')
  })
})
