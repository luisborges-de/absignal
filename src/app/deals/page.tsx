'use client'

import { useMemo, useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { PageShell } from '@/components/layout/PageShell'
import { DealCard } from '@/components/deals/DealCard'
import { useDeals } from '@/hooks/useDeals'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useEvaluations } from '@/hooks/useEvaluations'
import { resolveWaterfallState } from '@/lib/engine/triggerEngine'
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

export default function DealsPage() {
  const [active, setActive] = useState('ALL')
  const deals = useDeals()
  const filtered = useMemo(
    () => (deals.data ?? []).filter((deal) => active === 'ALL' || deal.status === active),
    [active, deals.data],
  )

  return (
    <PageShell showDemoBanner>
      <section className="py-section">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-caption-md font-bold uppercase text-nv-mute">Deal Surveillance</p>
            <h1 className="mt-2 text-display-lg font-bold">ABS Deals</h1>
          </div>
          <Tabs items={tabItems} active={active} onChange={setActive} />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((deal) => (
            <DealCardContainer key={deal.id} deal={deal} />
          ))}
        </div>
      </section>
    </PageShell>
  )
}
