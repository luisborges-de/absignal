import type { DealMarket } from '@/lib/types/deal'

export interface MarketConfig {
  market: DealMarket
  label: string
  /** Representative city used in signal labels. */
  city: string
  /** NWS observation station identifier. */
  nwsStationId: string
  /** Lat,lon point for NWS active-alert lookups. */
  nwsAlertPoint: string
  /** EIA hourly demand respondent code. */
  eiaRespondent: string
  /** Human-readable grid operator name. */
  gridLabel: string
}

export const MARKETS: Record<DealMarket, MarketConfig> = {
  NORTHERN_VIRGINIA: {
    market: 'NORTHERN_VIRGINIA',
    label: 'Northern Virginia',
    city: 'Ashburn',
    nwsStationId: 'KIAD',
    nwsAlertPoint: '39.0438,-77.4874',
    eiaRespondent: 'PJM',
    gridLabel: 'PJM',
  },
  SILICON_VALLEY: {
    market: 'SILICON_VALLEY',
    label: 'Silicon Valley',
    city: 'San Jose',
    nwsStationId: 'KSJC',
    nwsAlertPoint: '37.3626,-121.9290',
    eiaRespondent: 'CISO',
    gridLabel: 'CAISO',
  },
  CHICAGO: {
    market: 'CHICAGO',
    label: 'Chicago',
    city: 'Chicago',
    nwsStationId: 'KORD',
    nwsAlertPoint: '41.9742,-87.9073',
    eiaRespondent: 'PJM',
    gridLabel: 'PJM (ComEd)',
  },
  DALLAS: {
    market: 'DALLAS',
    label: 'Dallas',
    city: 'Dallas',
    nwsStationId: 'KDFW',
    nwsAlertPoint: '32.8998,-97.0403',
    eiaRespondent: 'ERCO',
    gridLabel: 'ERCOT',
  },
  PHOENIX: {
    market: 'PHOENIX',
    label: 'Phoenix',
    city: 'Phoenix',
    nwsStationId: 'KPHX',
    nwsAlertPoint: '33.4373,-112.0078',
    eiaRespondent: 'AZPS',
    gridLabel: 'AZPS (Arizona)',
  },
}

export function getMarketConfig(market: string | null | undefined): MarketConfig {
  if (market && market in MARKETS) return MARKETS[market as DealMarket]
  return MARKETS.NORTHERN_VIRGINIA
}
