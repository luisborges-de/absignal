'use client'

import { PageShell } from '@/components/layout/PageShell'
import { DealHeader } from '@/components/deals/DealHeader'
import { DealSubNav } from '@/components/deals/DealSubNav'
import { Card } from '@/components/ui/Card'
import { DSCRGauge } from '@/components/waterfall/DSCRGauge'
import { TriggerDistanceBar } from '@/components/waterfall/TriggerDistanceBar'
import { WaterfallDiagram } from '@/components/waterfall/WaterfallDiagram'
import { resolveWaterfallState } from '@/lib/engine/triggerEngine'
import { buildWaterfallSummary } from '@/lib/engine/waterfallEngine'
import { useDeal } from '@/hooks/useDeals'
import { useEvaluations } from '@/hooks/useEvaluations'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useTriggerRules } from '@/hooks/useTriggerRules'
import { useUIStore } from '@/store/uiStore'

export default function WaterfallPage({ params }: { params: { dealId: string } }) {
  const deal = useDeal(params.dealId)
  const snapshots = useSnapshots(params.dealId)
  const rules = useTriggerRules(params.dealId)
  const evaluations = useEvaluations(params.dealId, rules.data?.map((rule) => rule.id) ?? [])
  const selectedSnapshotId = useUIStore((state) => state.selectedSnapshotId)
  const latestSnapshot = snapshots.data?.at(-1)
  const selectedSnapshot =
    snapshots.data?.find((snapshot) => snapshot.id === selectedSnapshotId) ?? latestSnapshot
  const selectedEvaluations = selectedSnapshot
    ? evaluations.data?.filter((evaluation) => evaluation.snapshotId === selectedSnapshot.id) ?? []
    : []
  const state = resolveWaterfallState(selectedEvaluations, deal.data?.arDate)
  const summary = buildWaterfallSummary(state, selectedSnapshot?.dscr ?? 0)

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
      <DealHeader deal={deal.data} latestSnapshot={latestSnapshot} />
      <DealSubNav dealId={params.dealId} />
      <section className="mx-auto space-y-8 px-6 py-section" style={{ maxWidth: 1280 }}>
        <div
          className={
            state === 'NORMAL'
              ? 'rounded-sm border border-nv-hairline bg-nv-canvas p-6 text-nv-ink'
              : 'rounded-sm bg-nv-dark p-6 text-nv-on-dark'
          }
        >
          <p className="text-caption-md font-bold uppercase text-nv-green">Waterfall State</p>
          <h1 className="mt-2 text-display-lg font-bold">{state.replaceAll('_', ' ')}</h1>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <WaterfallDiagram summary={summary} />
          <DSCRGauge dscr={selectedSnapshot?.dscr ?? 0} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(rules.data ?? []).map((rule) => (
            <TriggerDistanceBar
              key={rule.id}
              rule={rule}
              evaluation={selectedEvaluations.find((evaluation) => evaluation.ruleId === rule.id)}
            />
          ))}
        </div>
      </section>
    </PageShell>
  )
}
