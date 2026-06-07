'use client'

import { PageShell } from '@/components/layout/PageShell'
import { DealHeader } from '@/components/deals/DealHeader'
import { DealSubNav } from '@/components/deals/DealSubNav'
import { TriggerStatusGrid } from '@/components/deals/TriggerStatusGrid'
import { Card } from '@/components/ui/Card'
import { useDeal } from '@/hooks/useDeals'
import { useSnapshots } from '@/hooks/useSnapshots'

export default function DealOverviewPage({ params }: { params: { dealId: string } }) {
  const deal = useDeal(params.dealId)
  const snapshots = useSnapshots(params.dealId)

  if (deal.isLoading) {
    return (
      <PageShell showDemoBanner>
        <section className="py-section">
          <Card className="min-h-[420px] animate-pulse" />
        </section>
      </PageShell>
    )
  }

  if (!deal.data) {
    return (
      <PageShell showDemoBanner>
        <section className="py-section">
          <Card>Deal not found.</Card>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell constrained={false} showDemoBanner>
      <DealHeader deal={deal.data} latestSnapshot={snapshots.data?.at(-1)} />
      <DealSubNav dealId={params.dealId} />
      <section className="mx-auto max-w-content px-6 py-section">
        <TriggerStatusGrid deal={deal.data} />
      </section>
    </PageShell>
  )
}
