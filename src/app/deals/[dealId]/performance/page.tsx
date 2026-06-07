'use client'

import { PageShell } from '@/components/layout/PageShell'
import { DealHeader } from '@/components/deals/DealHeader'
import { DealSubNav } from '@/components/deals/DealSubNav'
import { PerformanceSnapshotForm } from '@/components/performance/PerformanceSnapshotForm'
import { MetricTrendChart } from '@/components/performance/MetricTrendChart'
import { SnapshotHistoryTable } from '@/components/performance/SnapshotHistoryTable'
import { Card } from '@/components/ui/Card'
import { useDeal } from '@/hooks/useDeals'
import { useEvaluations } from '@/hooks/useEvaluations'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useTriggerRules } from '@/hooks/useTriggerRules'

export default function PerformancePage({ params }: { params: { dealId: string } }) {
  const deal = useDeal(params.dealId)
  const snapshots = useSnapshots(params.dealId)
  const rules = useTriggerRules(params.dealId)
  const evaluations = useEvaluations(params.dealId, rules.data?.map((rule) => rule.id) ?? [])
  const data = snapshots.data ?? []

  if (!deal.data) {
    return (
      <PageShell showDemoBanner>
        <section className="py-section">
          <Card className="min-h-[420px] animate-pulse" />
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell constrained={false} showDemoBanner>
      <DealHeader deal={deal.data} latestSnapshot={data.at(-1)} />
      <DealSubNav dealId={params.dealId} />
      <section className="mx-auto space-y-8 px-6 py-section" style={{ maxWidth: 1280 }}>
        <PerformanceSnapshotForm dealId={params.dealId} />
        <div className="grid gap-6 md:grid-cols-2">
          <MetricTrendChart
            title="DSCR"
            data={data}
            metric="dscr"
            thresholds={[
              { value: 1.35, label: 'Cash Trap', color: '#df6500' },
              { value: 1.1, label: 'Early Amortisation', color: '#e52020' },
            ]}
            valueFormatter={(value) => `${value.toFixed(2)}x`}
          />
          <MetricTrendChart
            title="Occupancy"
            data={data}
            metric="occupancyRate"
            thresholds={[{ value: 0.75, label: 'Reserve', color: '#df6500' }]}
            valueFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <MetricTrendChart
            title="LTV"
            data={data}
            metric="ltv"
            thresholds={[{ value: 0.65, label: 'Sweep', color: '#df6500' }]}
            valueFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <MetricTrendChart
            title="Top Tenant"
            data={data}
            metric="topTenantRevenuePct"
            thresholds={[{ value: 0.4, label: 'Concentration', color: '#df6500' }]}
            valueFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </div>
        <SnapshotHistoryTable snapshots={data} evaluations={evaluations.data ?? []} />
      </section>
    </PageShell>
  )
}
