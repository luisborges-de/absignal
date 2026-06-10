'use client'

import Link from 'next/link'
import { FilePlus2, FlaskConical, Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageShell } from '@/components/layout/PageShell'
import { DealCard } from '@/components/deals/DealCard'
import { PortfolioHeatStrip } from '@/components/deals/PortfolioHeatStrip'
import { useDeals } from '@/hooks/useDeals'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useEvaluations } from '@/hooks/useEvaluations'
import { loadDemoData } from '@/lib/demo/localStore'
import { isDemoModeEnabled, setDemoModeEnabled } from '@/lib/demo/demoMode'
import { resolveWaterfallState } from '@/lib/engine/triggerEngine'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/types/deal'
import type { TriggerStatus } from '@/lib/types/trigger'

const tabItems = [
  { label: 'ALL', value: 'ALL' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'WATCH', value: 'WATCH' },
  { label: 'BREACH', value: 'BREACH' },
]

function DealCardContainer({ deal }: { deal: Deal }) {
  const snapshots = useSnapshots(deal.id)
  const evaluations = useEvaluations(deal.id)
  const latestSnapshot = snapshots.data?.at(-1)
  const latestEvaluations = latestSnapshot
    ? evaluations.data?.filter((evaluation) => evaluation.snapshotId === latestSnapshot.id) ?? []
    : []
  const status: TriggerStatus = latestEvaluations.some((evaluation) => evaluation.status === 'BREACH')
    ? 'BREACH'
    : latestEvaluations.some((evaluation) => evaluation.status === 'WATCH')
      ? 'WATCH'
      : 'SAFE'

  return (
    <DealCard
      deal={deal}
      snapshot={latestSnapshot}
      status={status}
      waterfallState={resolveWaterfallState(latestEvaluations, deal.arDate)}
    />
  )
}

function DealsEmptyState({ onEnableDemo }: { onEnableDemo: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-5 py-16 text-center">
      <FilePlus2 className="h-10 w-10 text-nv-green" aria-hidden="true" />
      <div className="max-w-md">
        <h2 className="text-heading-xl font-bold">No deals yet</h2>
        <p className="mt-2 text-body-sm text-nv-body">
          Upload a presale report or indenture and AI drafts the full deal configuration —
          metadata, covenant triggers, and a closing snapshot — ready for monitoring.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/deals/new">
          <Button icon={<FilePlus2 className="h-4 w-4" aria-hidden="true" />}>
            New deal — upload a document
          </Button>
        </Link>
        <Button
          variant="outline"
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          onClick={onEnableDemo}
        >
          Load demo deals
        </Button>
      </div>
    </Card>
  )
}

export default function DealsPage() {
  const [active, setActive] = useState('ALL')
  const [demoMode, setDemoMode] = useState(false)
  const queryClient = useQueryClient()
  const deals = useDeals()
  const filtered = useMemo(
    () => (deals.data ?? []).filter((deal) => active === 'ALL' || deal.status === active),
    [active, deals.data],
  )
  const isEmpty = deals.isSuccess && (deals.data?.length ?? 0) === 0

  // Sync the toggle from persisted state after hydration.
  useEffect(() => setDemoMode(isDemoModeEnabled()), [])

  function toggleDemo(next: boolean) {
    setDemoModeEnabled(next)
    if (next && !isSupabaseConfigured()) loadDemoData()
    setDemoMode(next)
    void queryClient.invalidateQueries()
  }

  return (
    <PageShell showDemoBanner>
      <section className="py-section">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-caption-md font-bold uppercase text-nv-mute">Deal Surveillance</p>
            <h1 className="mt-2 text-display-lg font-bold">ABS Deals</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isEmpty && <Tabs items={tabItems} active={active} onChange={setActive} />}
            <button
              type="button"
              onClick={() => toggleDemo(!demoMode)}
              className={cn(
                'flex items-center gap-2 rounded-sm border px-3 py-2 text-caption-md font-bold uppercase transition-colors',
                demoMode
                  ? 'border-nv-green bg-nv-green/10 text-nv-green'
                  : 'border-nv-hairline text-nv-mute hover:border-nv-green',
              )}
              title="Show or hide the built-in sample deals"
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              Demo data: {demoMode ? 'On' : 'Off'}
            </button>
            {!isEmpty && (
              <Link href="/deals/new">
                <Button icon={<FilePlus2 className="h-4 w-4" aria-hidden="true" />}>New deal</Button>
              </Link>
            )}
          </div>
        </div>
        {isEmpty ? (
          <DealsEmptyState onEnableDemo={() => toggleDemo(true)} />
        ) : (
          <>
            <PortfolioHeatStrip />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((deal) => (
                <DealCardContainer key={deal.id} deal={deal} />
              ))}
            </div>
          </>
        )}
      </section>
    </PageShell>
  )
}
