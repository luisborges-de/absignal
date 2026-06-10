import { computeRatios } from '@/lib/engine/ratios'
import { MARKETS, type MarketConfig } from '@/lib/live-signals/markets'
import type { PerformanceSnapshot, PerformanceSnapshotInput } from '@/lib/types/performance'

export type LiveSignalProvider = 'NWS' | 'EIA' | 'VIANEXUS'
export type LiveSignalSeverity = 'INFO' | 'WATCH' | 'STRESS'
export type ProviderStatus = 'ok' | 'skipped' | 'error'

export interface LiveSignal {
  provider: LiveSignalProvider
  label: string
  value: number
  unit: string
  observedAt: string
  severity: LiveSignalSeverity
  sourceUrl?: string
  detail?: string
}

export interface LiveSignalProviderStatus {
  provider: LiveSignalProvider | 'UNKNOWN'
  status: ProviderStatus
  message?: string
}

export interface LiveSignalProviderResult {
  provider: LiveSignalProvider
  status: ProviderStatus
  signals: LiveSignal[]
  message?: string
}

export interface CreditImpactMetric {
  metric: keyof PerformanceSnapshotInput | 'dscr'
  label: string
  previousValue: number
  projectedValue: number
  unit: string
}

export interface CreditImpactPreview {
  changedMetrics: CreditImpactMetric[]
  estimatedDscr: number
  rationale: string
  confidence: number
  scenarioSnapshot?: PerformanceSnapshotInput
  /**
   * Scenario snapshot with dscr/seniorDscr/ltv attached server-side (same ratio
   * math as snapshot persistence) so clients can run trigger evaluations on it
   * without re-implementing ratio logic.
   */
  scenarioEvaluationSnapshot?: PerformanceSnapshot
}

export interface LiveSignalsResponse {
  dealId: string
  fetchedAt: string
  signals: LiveSignal[]
  providerStatus: LiveSignalProviderStatus[]
  impactPreview: CreditImpactPreview
  canApplySnapshot: boolean
}

interface NwsObservation {
  properties?: {
    timestamp?: string
    temperature?: { value?: number | null } | null
    heatIndex?: { value?: number | null } | null
  }
}

interface NwsAlerts {
  features?: Array<{
    properties?: {
      event?: string | null
    }
  }>
}

interface ViaNexusQuote {
  avgTotalVolume?: number
  calculationPrice?: string
  change?: number
  changePercent?: number
  close?: number
  companyName?: string
  currency?: string
  delayedPrice?: number
  extendedPrice?: number
  latestPrice?: number
  latestTime?: string
  symbol?: string
}

interface ViaNexusCompanyDescription {
  cik?: string
  companyName?: string
  employeeCount?: number
  filingDate?: string
  filingUrl?: string
  shortSummary?: string
  symbol?: string
}

const VIANEXUS_BASE_URL = 'https://api.blueskyapi.com/v1/data'
const DATA_CENTER_MARKET_SYMBOLS = ['EQIX', 'DLR']

const DEFAULT_MARKET = MARKETS.NORTHERN_VIRGINIA

function nwsObservationUrl(config: MarketConfig) {
  return `https://api.weather.gov/stations/${config.nwsStationId}/observations/latest`
}

function nwsAlertsUrl(config: MarketConfig) {
  return `https://api.weather.gov/alerts/active?point=${config.nwsAlertPoint}`
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function celsiusToFahrenheit(value: number) {
  return round((value * 9) / 5 + 32, 1)
}

function heatSeverity(fahrenheit: number): LiveSignalSeverity {
  if (fahrenheit >= 95) return 'STRESS'
  if (fahrenheit >= 85) return 'WATCH'
  return 'INFO'
}

function providerHeaders() {
  return {
    Accept: 'application/json',
    'User-Agent': 'ABSignal hackathon prototype demo@absignal.io',
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3500)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`Request failed with ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

function appendQuery(url: URL, params: Record<string, string>) {
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

function normalizeObservedAt(value: string | undefined) {
  if (!value) return new Date().toISOString()

  const hourlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/)
  if (hourlyMatch) {
    const [, year, month, day, hour] = hourlyMatch
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour))).toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

async function requestViaNexusPath<T>(baseUrl: string, path: string, token: string): Promise<T> {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.replace(/^\/+/, '')
  const url = new URL(`${normalizedBase}/${normalizedPath}`)

  return requestJson<T>(appendQuery(url, { token }), { headers: providerHeaders() })
}

export function normalizeWeatherSignals(
  observation: NwsObservation,
  alerts?: NwsAlerts,
  marketConfig: MarketConfig = DEFAULT_MARKET,
): LiveSignal[] {
  const observedAt = observation.properties?.timestamp ?? new Date().toISOString()
  const heatValue = observation.properties?.heatIndex?.value
  const temperatureValue = observation.properties?.temperature?.value
  const celsiusValue = typeof heatValue === 'number' ? heatValue : temperatureValue
  const signals: LiveSignal[] = []

  if (typeof celsiusValue === 'number' && Number.isFinite(celsiusValue)) {
    const fahrenheit = celsiusToFahrenheit(celsiusValue)
    signals.push({
      provider: 'NWS',
      label: typeof heatValue === 'number'
        ? `${marketConfig.city} heat index`
        : `${marketConfig.city} temperature`,
      value: fahrenheit,
      unit: 'F',
      observedAt,
      severity: heatSeverity(fahrenheit),
      sourceUrl: nwsObservationUrl(marketConfig),
      detail: `Weather proxy for cooling load and uptime stress in the ${marketConfig.label} market.`,
    })
  }

  const alertEvents = alerts?.features
    ?.map((feature) => feature.properties?.event)
    .filter((event): event is string => Boolean(event)) ?? []

  if (alertEvents.length > 0) {
    signals.push({
      provider: 'NWS',
      label: 'Weather alert',
      value: alertEvents.length,
      unit: 'active alerts',
      observedAt,
      severity: 'WATCH',
      sourceUrl: nwsAlertsUrl(marketConfig),
      detail: alertEvents.slice(0, 2).join(', '),
    })
  }

  return signals
}

function marketMoveSeverity(changePercent: number): LiveSignalSeverity {
  if (changePercent <= -6) return 'STRESS'
  if (changePercent <= -3) return 'WATCH'
  return 'INFO'
}

export function normalizeViaNexusSignals(
  quotes: ViaNexusQuote[],
  profiles: ViaNexusCompanyDescription[],
  observedAt = new Date().toISOString(),
): LiveSignal[] {
  const quoteSignals = quotes
    .filter((quote) => quote.companyName || quote.symbol)
    .map((quote) => {
      const symbol = quote.symbol ?? quote.companyName ?? 'Market'
      const changePercent = typeof quote.changePercent === 'number' ? round(quote.changePercent * 100, 2) : 0
      const price = quote.latestPrice ?? quote.delayedPrice ?? quote.extendedPrice ?? quote.close
      const priceDetail = typeof price === 'number'
        ? `${quote.companyName ?? symbol} at ${quote.currency ?? 'USD'} ${round(price, 2)}`
        : quote.companyName ?? symbol

      return {
        provider: 'VIANEXUS' as const,
        label: `${symbol} market move`,
        value: changePercent,
        unit: '%',
        observedAt,
        severity: marketMoveSeverity(changePercent),
        sourceUrl: 'https://vianexus.com/',
        detail: `${priceDetail}. Public market context for data-center operators; not used directly in DSCR math.`,
      }
    })

  const profileSymbols = profiles
    .map((profile) => profile.symbol)
    .filter((symbol): symbol is string => Boolean(symbol))

  if (profileSymbols.length === 0) return quoteSignals

  return [
    ...quoteSignals,
    {
      provider: 'VIANEXUS',
      label: 'Operator intelligence coverage',
      value: profileSymbols.length,
      unit: 'profiles',
      observedAt,
      severity: 'INFO',
      sourceUrl: 'https://vianexus.com/',
      detail: `Company profile and filing context available for ${profileSymbols.join(', ')}.`,
    },
  ]
}

export async function fetchWeatherSignals(
  marketConfig: MarketConfig = DEFAULT_MARKET,
): Promise<LiveSignalProviderResult> {
  const [observation, alerts] = await Promise.all([
    requestJson<NwsObservation>(nwsObservationUrl(marketConfig), { headers: providerHeaders() }),
    requestJson<NwsAlerts>(nwsAlertsUrl(marketConfig), { headers: providerHeaders() }),
  ])

  return {
    provider: 'NWS',
    status: 'ok',
    signals: normalizeWeatherSignals(observation, alerts, marketConfig),
  }
}

/** Severity bands scale with grid size: PJM peaks near 160 GW, AZPS near 8 GW. */
const GRID_STRESS_THRESHOLDS: Record<string, { watch: number; stress: number }> = {
  PJM: { watch: 125_000, stress: 150_000 },
  CISO: { watch: 35_000, stress: 45_000 },
  ERCO: { watch: 65_000, stress: 80_000 },
  AZPS: { watch: 6_000, stress: 7_500 },
}

export async function fetchGridSignals(
  marketConfig: MarketConfig = DEFAULT_MARKET,
): Promise<LiveSignalProviderResult> {
  const apiKey = process.env.EIA_API_KEY
  if (!apiKey) {
    return { provider: 'EIA', status: 'skipped', signals: [], message: 'EIA_API_KEY is not configured.' }
  }

  const respondent = marketConfig.eiaRespondent
  const endpoint =
    'https://api.eia.gov/v2/electricity/rto/region-data/data/' +
    `?api_key=${encodeURIComponent(apiKey)}` +
    `&frequency=hourly&data[0]=value&facets[respondent][]=${encodeURIComponent(respondent)}&facets[type][]=D` +
    '&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1'

  const json = await requestJson<{ response?: { data?: Array<{ period?: string; value?: number }> } }>(
    endpoint,
    { headers: providerHeaders() },
  )
  const row = json.response?.data?.[0]
  // EIA v2 returns `value` as a numeric string (e.g. "23281"); coerce it.
  const numericValue = typeof row?.value === 'string' ? Number(row.value) : row?.value
  const value = typeof numericValue === 'number' && Number.isFinite(numericValue) ? numericValue : null

  if (value === null) {
    return {
      provider: 'EIA',
      status: 'ok',
      signals: [],
      message: `No recent ${marketConfig.gridLabel} demand data returned.`,
    }
  }

  const thresholds = GRID_STRESS_THRESHOLDS[respondent] ?? GRID_STRESS_THRESHOLDS.PJM

  return {
    provider: 'EIA',
    status: 'ok',
    signals: [
      {
        provider: 'EIA',
        label: `${marketConfig.gridLabel} grid demand`,
        value,
        unit: 'MW',
        observedAt: normalizeObservedAt(row?.period),
        severity: value > thresholds.stress ? 'STRESS' : value > thresholds.watch ? 'WATCH' : 'INFO',
        sourceUrl: 'https://www.eia.gov/opendata/',
        detail: `Grid-demand proxy for power-cost and availability stress in the ${marketConfig.label} market.`,
      },
    ],
  }
}

export async function fetchViaNexusSignals(): Promise<LiveSignalProviderResult> {
  const token = process.env.VIANEXUS_API_TOKEN
  if (!token) {
    return {
      provider: 'VIANEXUS',
      status: 'skipped',
      signals: [],
      message: 'VIANEXUS_API_TOKEN is not configured.',
    }
  }

  const baseUrl = process.env.VIANEXUS_API_BASE_URL ?? VIANEXUS_BASE_URL
  const [quoteResults, profileResults] = await Promise.all([
    Promise.allSettled(
      DATA_CENTER_MARKET_SYMBOLS.map((symbol) =>
        requestViaNexusPath<ViaNexusQuote[]>(baseUrl, `CORE/QUOTE/${symbol}`, token),
      ),
    ),
    Promise.allSettled(
      DATA_CENTER_MARKET_SYMBOLS.map((symbol) =>
        requestViaNexusPath<ViaNexusCompanyDescription[]>(
          baseUrl,
          `CORE/COMPANY_DESCRIPTIONS/${symbol}`,
          token,
        ),
      ),
    ),
  ])

  const quotes = quoteResults.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  const profiles = profileResults.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  const signals = normalizeViaNexusSignals(quotes, profiles)

  if (signals.length === 0) {
    return {
      provider: 'VIANEXUS',
      status: 'ok',
      signals: [],
      message: 'ViaNexus returned no data-center market context.',
    }
  }

  return {
    provider: 'VIANEXUS',
    status: 'ok',
    signals,
  }
}

function maxSeverityWeight(signals: LiveSignal[], provider: LiveSignalProvider, weights: Record<LiveSignalSeverity, number>) {
  return signals
    .filter((signal) => signal.provider === provider)
    .reduce((max, signal) => Math.max(max, weights[signal.severity]), 0)
}

export function buildCreditImpactPreview(
  latestSnapshot: PerformanceSnapshot,
  signals: LiveSignal[],
  asOf = new Date(),
): CreditImpactPreview {
  const weatherStress = maxSeverityWeight(signals, 'NWS', { INFO: 0, WATCH: 0.03, STRESS: 0.06 })
  const gridStress = maxSeverityWeight(signals, 'EIA', { INFO: 0, WATCH: 0.025, STRESS: 0.05 })
  const expenseStressPct = weatherStress + gridStress
  const projectedPue = round(latestSnapshot.pueRatio + weatherStress, 3)
  const projectedPowerCost = round(latestSnapshot.powerCostPerKwh * (1 + gridStress), 4)
  const projectedOperatingExpenses = Math.round(latestSnapshot.operatingExpenses * (1 + expenseStressPct))
  const incrementalExpense = projectedOperatingExpenses - latestSnapshot.operatingExpenses
  const projectedNetCashFlow = Math.max(0, latestSnapshot.netCashFlow - incrementalExpense)
  const estimatedDscr = latestSnapshot.scheduledDebtService > 0
    ? round(projectedNetCashFlow / latestSnapshot.scheduledDebtService, 4)
    : 0

  const changedMetrics: CreditImpactMetric[] = [
    {
      metric: 'pueRatio',
      label: 'PUE ratio',
      previousValue: latestSnapshot.pueRatio,
      projectedValue: projectedPue,
      unit: 'x',
    },
    {
      metric: 'powerCostPerKwh',
      label: 'Power cost',
      previousValue: latestSnapshot.powerCostPerKwh,
      projectedValue: projectedPowerCost,
      unit: '$/kWh',
    },
    {
      metric: 'operatingExpenses',
      label: 'Operating expenses',
      previousValue: latestSnapshot.operatingExpenses,
      projectedValue: projectedOperatingExpenses,
      unit: 'USD',
    },
    {
      metric: 'netCashFlow',
      label: 'Net cash flow',
      previousValue: latestSnapshot.netCashFlow,
      projectedValue: projectedNetCashFlow,
      unit: 'USD',
    },
    {
      metric: 'dscr',
      label: 'DSCR',
      previousValue: latestSnapshot.dscr,
      projectedValue: estimatedDscr,
      unit: 'x',
    },
  ]

  const providerList = [...new Set(signals.map((signal) => signal.provider))].join(' + ') || 'external proxy'
  const scenarioSnapshot: PerformanceSnapshotInput = {
    periodDate: asOf.toISOString().slice(0, 10),
    occupancyRate: latestSnapshot.occupancyRate,
    leasedCapacityMW: latestSnapshot.leasedCapacityMW,
    totalCapacityMW: latestSnapshot.totalCapacityMW,
    contractedRevenue: latestSnapshot.contractedRevenue,
    grossRevenue: latestSnapshot.grossRevenue,
    operatingExpenses: projectedOperatingExpenses,
    netCashFlow: projectedNetCashFlow,
    scheduledDebtService: latestSnapshot.scheduledDebtService,
    seniorDebtService: latestSnapshot.seniorDebtService,
    pueRatio: projectedPue,
    powerCostPerKwh: projectedPowerCost,
    topTenantRevenuePct: latestSnapshot.topTenantRevenuePct,
    tenantCount: latestSnapshot.tenantCount,
    weightedAvgRemainingLeaseTerm: latestSnapshot.weightedAvgRemainingLeaseTerm,
    outstandingBalance: latestSnapshot.outstandingBalance,
    appraisedValue: latestSnapshot.appraisedValue,
    seniorInterestReserveBalance: latestSnapshot.seniorInterestReserveBalance,
    expenseReserveBalance: latestSnapshot.expenseReserveBalance,
    requiredReserveBalance: latestSnapshot.requiredReserveBalance,
    source: 'MANUAL',
    notes: `Generated from live proxy signals: ${providerList}. Preview converts external operating stress into a scenario snapshot; not private data-center telemetry.`,
  }

  const scenarioEvaluationSnapshot: PerformanceSnapshot = {
    ...scenarioSnapshot,
    id: 'scenario-preview',
    dealId: latestSnapshot.dealId,
    ...computeRatios(scenarioSnapshot),
    source: scenarioSnapshot.source ?? 'MANUAL',
    createdAt: asOf.toISOString(),
  }

  return {
    changedMetrics,
    estimatedDscr,
    scenarioSnapshot,
    scenarioEvaluationSnapshot,
    confidence: round(Math.min(0.86, 0.58 + expenseStressPct * 2), 2),
    rationale:
      expenseStressPct > 0
        ? 'External operating proxies indicate higher cooling or power-cost stress, reducing projected net cash flow and DSCR.'
        : 'No external proxy stress detected; scenario mirrors the latest snapshot while preserving source context.',
  }
}

export async function fetchProviderSignals(
  providers: Array<() => Promise<LiveSignalProviderResult | LiveSignalProviderResult[]>>,
) {
  const settled = await Promise.allSettled(providers.map((provider) => provider()))
  const statuses: LiveSignalProviderStatus[] = []
  const signals: LiveSignal[] = []

  settled.forEach((result) => {
    if (result.status === 'rejected') {
      statuses.push({
        provider: 'UNKNOWN',
        status: 'error',
        message: result.reason instanceof Error ? result.reason.message : 'Provider failed.',
      })
      return
    }

    const results = Array.isArray(result.value) ? result.value : [result.value]
    results.forEach((providerResult) => {
      statuses.push({
        provider: providerResult.provider,
        status: providerResult.status,
        message: providerResult.message,
      })
      signals.push(...providerResult.signals)
    })
  })

  return { signals, statuses }
}
