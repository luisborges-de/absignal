import { NextResponse } from 'next/server'
import { demoSnapshots } from '@/lib/demo/seedDemo'
import {
  buildCreditImpactPreview,
  fetchGridSignals,
  fetchProviderSignals,
  fetchViaNexusSignals,
  fetchWeatherSignals,
  type LiveSignalProvider,
  type LiveSignalProviderResult,
} from '@/lib/live-signals/liveSignals'
import { getMarketConfig } from '@/lib/live-signals/markets'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { mapSnapshot } from '@/lib/supabase/queries/mappers'
import { createClient } from '@/lib/supabase/server'
import type { PerformanceSnapshot } from '@/lib/types/performance'

export const dynamic = 'force-dynamic'

async function getLatestSnapshot(dealId: string): Promise<PerformanceSnapshot | NextResponse> {
  if (!isSupabaseConfigured()) {
    const snapshot = demoSnapshots.filter((item) => item.dealId === dealId).at(-1)
    if (!snapshot) return NextResponse.json({ error: 'No performance snapshot found.' }, { status: 404 })
    return snapshot
  }

  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('performance_snapshots')
    .select('*')
    .eq('deal_id', dealId)
    .order('period_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No performance snapshot found.' }, { status: 404 })
  return mapSnapshot(data)
}

function safeProvider(provider: LiveSignalProvider, fetcher: () => Promise<LiveSignalProviderResult>) {
  return async () => {
    try {
      return await fetcher()
    } catch (error) {
      return {
        provider,
        status: 'error' as const,
        signals: [],
        message: error instanceof Error ? error.message : 'Provider failed.',
      }
    }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const dealId = url.searchParams.get('dealId')
  const marketConfig = getMarketConfig(url.searchParams.get('market'))

  if (!dealId) {
    return NextResponse.json({ error: 'dealId is required.' }, { status: 400 })
  }

  const latestSnapshot = await getLatestSnapshot(dealId)
  if (latestSnapshot instanceof NextResponse) return latestSnapshot

  const { signals, statuses } = await fetchProviderSignals([
    safeProvider('NWS', () => fetchWeatherSignals(marketConfig)),
    safeProvider('EIA', () => fetchGridSignals(marketConfig)),
    safeProvider('VIANEXUS', fetchViaNexusSignals),
  ])
  const impactPreview = buildCreditImpactPreview(latestSnapshot, signals)

  return NextResponse.json({
    dealId,
    market: marketConfig.market,
    fetchedAt: new Date().toISOString(),
    signals,
    providerStatus: statuses,
    impactPreview,
    canApplySnapshot: Boolean(impactPreview.scenarioSnapshot),
  })
}
