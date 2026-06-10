'use client'

import { AlertTriangle, RefreshCw, Satellite, Wand2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { evaluationKeys } from '@/hooks/useEvaluations'
import { useDeal } from '@/hooks/useDeals'
import { useCreateSnapshot, useSnapshots } from '@/hooks/useSnapshots'
import { useTriggerRules } from '@/hooks/useTriggerRules'
import { evaluateAllTriggers } from '@/lib/engine/triggerEngine'
import { MARKETS } from '@/lib/live-signals/markets'
import { cn, formatCurrency, formatRatio } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import type { LiveSignal, LiveSignalsResponse, ProviderStatus } from '@/lib/live-signals/liveSignals'
import type { TriggerEvaluation, TriggerRule, TriggerStatus } from '@/lib/types/trigger'

function severityClass(severity: LiveSignal['severity']) {
  if (severity === 'STRESS') return 'border-nv-error/30 bg-nv-error/10 text-nv-error'
  if (severity === 'WATCH') return 'border-nv-warning/30 bg-nv-warning/10 text-nv-warning'
  return 'border-nv-success/30 bg-nv-success/10 text-nv-success'
}

function statusClass(status: ProviderStatus) {
  if (status === 'ok') return 'border-nv-success/30 bg-nv-success/10 text-nv-success'
  if (status === 'error') return 'border-nv-error/30 bg-nv-error/10 text-nv-error'
  return 'border-nv-hairline bg-nv-soft text-nv-mute'
}

function formatSignalValue(signal: LiveSignal) {
  if (signal.unit === 'USD') return formatCurrency(signal.value)
  if (signal.unit === 'F') return `${signal.value.toFixed(1)}F`
  return `${signal.value.toLocaleString()} ${signal.unit}`
}

function formatMetricValue(value: number, unit: string) {
  if (unit === 'USD') return formatCurrency(value)
  if (unit === 'x') return formatRatio(value)
  if (unit === '$/kWh') return `$${value.toFixed(4)}`
  return value.toLocaleString()
}

const NO_SNAPSHOT = 'NO_SNAPSHOT'

async function fetchLiveSignals(dealId: string, market?: string) {
  const params = new URLSearchParams({ dealId })
  if (market) params.set('market', market)
  const response = await fetch(`/api/live-signals?${params.toString()}`)
  if (response.status === 404) throw new Error(NO_SNAPSHOT)
  if (!response.ok) throw new Error('Unable to load live proxy signals.')
  return (await response.json()) as LiveSignalsResponse
}

const STATUS_RANK: Record<TriggerStatus, number> = { 'N/A': -1, SAFE: 0, WATCH: 1, BREACH: 2 }

interface ThresholdCrossing {
  rule: TriggerRule
  current: TriggerEvaluation
  projected: TriggerEvaluation
}

function formatThresholdValue(value: number | null, unit: string) {
  if (value === null) return 'N/A'
  if (unit === 'x') return formatRatio(value)
  if (unit === '%') return `${(value * 100).toFixed(1)}%`
  if (unit === 'USD') return formatCurrency(value)
  if (unit === '$/kWh') return `$${value.toFixed(4)}`
  return `${value.toLocaleString()} ${unit}`
}

function crossingSentence(crossing: ThresholdCrossing) {
  const { rule, projected } = crossing
  const projectedValue = formatThresholdValue(projected.currentValue, rule.thresholdUnit)
  const threshold = formatThresholdValue(rule.threshold, rule.thresholdUnit)
  const distance = projected.distanceToBreachPct

  if (projected.status === 'BREACH') {
    const beyond = distance !== null ? ` — ${Math.abs(distance * 100).toFixed(1)}% beyond trigger` : ''
    return `Projected ${rule.metricKey} ${projectedValue} would breach the ${rule.name} threshold (${threshold})${beyond}.`
  }

  const headroom = distance !== null ? ` — only ${(distance * 100).toFixed(1)}% of headroom left` : ''
  return `Projected ${rule.metricKey} ${projectedValue} enters the watch zone for ${rule.name} (${threshold})${headroom}.`
}

export function LiveSignalPanel({ dealId }: { dealId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const mutation = useCreateSnapshot(dealId)
  const setSelectedSnapshot = useUIStore((store) => store.setSelectedSnapshot)
  const deal = useDeal(dealId)
  const rules = useTriggerRules(dealId)
  const snapshots = useSnapshots(dealId)
  const market = deal.data?.market
  const query = useQuery({
    queryKey: ['live-signals', dealId, market ?? 'default'],
    queryFn: () => fetchLiveSignals(dealId, market),
    enabled: Boolean(dealId) && Boolean(deal.data),
    retry: (failureCount, error) =>
      error instanceof Error && error.message === NO_SNAPSHOT ? false : failureCount < 2,
  })

  const crossings = useMemo<ThresholdCrossing[]>(() => {
    const scenario = query.data?.impactPreview.scenarioEvaluationSnapshot
    const activeRules = (rules.data ?? []).filter(
      (rule) => rule.active && rule.extractionStatus === 'APPROVED',
    )
    const history = snapshots.data ?? []
    if (!scenario || !activeRules.length || !history.length) return []

    const current = evaluateAllTriggers(activeRules, history)
    const projected = evaluateAllTriggers(activeRules, [...history, scenario])

    return activeRules
      .map((rule, index) => ({ rule, current: current[index], projected: projected[index] }))
      .filter(
        ({ current: currentEval, projected: projectedEval }) =>
          STATUS_RANK[projectedEval.status] >= 1 &&
          STATUS_RANK[projectedEval.status] > STATUS_RANK[currentEval.status],
      )
      .sort((a, b) => STATUS_RANK[b.projected.status] - STATUS_RANK[a.projected.status])
  }, [query.data, rules.data, snapshots.data])

  const hasBreachCrossing = crossings.some((crossing) => crossing.projected.status === 'BREACH')
  const noSnapshotYet =
    query.isError && query.error instanceof Error && query.error.message === NO_SNAPSHOT

  async function applyScenario() {
    const input = query.data?.impactPreview.scenarioSnapshot
    if (!input) return

    const snapshot = await mutation.mutateAsync({ dealId, input })
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, snapshotId: snapshot.id, snapshot }),
    })

    if (!response.ok) throw new Error('Evaluation failed.')
    const data = (await response.json()) as { evaluations: TriggerEvaluation[] }
    queryClient.setQueryData<TriggerEvaluation[]>(evaluationKeys.all(dealId), (previous = []) => [
      ...previous.filter((item) => !data.evaluations.some((evaluation) => evaluation.id === item.id)),
      ...data.evaluations,
    ])
    setSelectedSnapshot(snapshot.id)
    setMessage('Scenario snapshot applied and evaluated.')
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-caption-md font-bold uppercase text-nv-mute">
            <Satellite className="h-4 w-4 text-nv-green" aria-hidden="true" />
            Live Proxy Signals
          </p>
          <h2 className="mt-1 text-heading-xl font-bold">Asset Stress Feed</h2>
          <p className="mt-2 max-w-3xl text-body-sm text-nv-body">
            Public weather and grid signals are translated into a preview scenario. ViaNexus can add
            sponsor-aligned financial market context when configured.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} aria-hidden="true" />}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh signals
        </Button>
      </div>

      {query.isLoading && <p className="mt-6 text-body-sm text-nv-mute">Loading live proxy signals...</p>}
      {noSnapshotYet && (
        <div className="mt-6 border border-nv-hairline bg-nv-soft p-5 text-center">
          <p className="text-body-sm font-bold text-nv-body">
            Add a snapshot or import a CSV to enable live signal projections.
          </p>
        </div>
      )}
      {query.isError && !noSnapshotYet && (
        <p className="mt-6 text-body-sm font-bold text-nv-error">
          {query.error instanceof Error ? query.error.message : 'Unable to load live proxy signals.'}
        </p>
      )}

      {query.data && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {query.data.providerStatus.map((provider) => (
              <span
                key={`${provider.provider}-${provider.status}`}
                title={provider.message}
                className={cn(
                  'inline-flex rounded-sm border px-2.5 py-1 text-[14px] font-bold uppercase',
                  statusClass(provider.status),
                )}
              >
                {provider.provider} {provider.status}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {query.data.signals.map((signal) => (
              <div key={`${signal.provider}-${signal.label}`} className="border border-nv-hairline bg-nv-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-caption-sm font-bold uppercase text-nv-mute">{signal.provider}</p>
                    <h3 className="mt-1 text-card-title font-bold">{signal.label}</h3>
                  </div>
                  <span
                    className={cn(
                      'inline-flex rounded-sm border px-2 py-1 text-utility-xs font-bold uppercase',
                      severityClass(signal.severity),
                    )}
                  >
                    {signal.severity}
                  </span>
                </div>
                <p className="mt-4 text-heading-xl font-bold">{formatSignalValue(signal)}</p>
                {signal.detail && <p className="mt-2 text-body-sm text-nv-body">{signal.detail}</p>}
                <p className="mt-3 text-caption-sm text-nv-mute">
                  Observed {new Date(signal.observedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {crossings.length > 0 && (
            <div
              className={cn(
                'mt-6 border-2 p-5',
                hasBreachCrossing
                  ? 'border-nv-error bg-nv-error/10'
                  : 'border-nv-warning bg-nv-warning/10',
              )}
            >
              <p
                className={cn(
                  'flex items-center gap-2 text-caption-md font-bold uppercase',
                  hasBreachCrossing ? 'text-nv-error' : 'text-nv-warning',
                )}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Threshold crossing under live stress
              </p>
              <p className="mt-2 text-body-sm text-nv-body">
                Under current {market ? MARKETS[market].label : 'market'} signal stress, this
                scenario would change {crossings.length === 1 ? 'one covenant test' : `${crossings.length} covenant tests`}:
              </p>
              <ul className="mt-3 space-y-2">
                {crossings.map((crossing) => (
                  <li
                    key={crossing.rule.id}
                    className={cn(
                      'border-l-2 pl-3 text-body-sm font-bold',
                      crossing.projected.status === 'BREACH'
                        ? 'border-nv-error text-nv-error'
                        : 'border-nv-warning text-nv-warning',
                    )}
                  >
                    {crossingSentence(crossing)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 border border-nv-hairline bg-nv-canvas p-4">
            <div className="grid gap-5 lg:grid-cols-[0.35fr_0.65fr]">
              <div>
                <p className="text-caption-md font-bold uppercase text-nv-mute">Credit Impact Preview</p>
                <p className="mt-2 text-display-lg font-bold">
                  {formatRatio(query.data.impactPreview.estimatedDscr)}
                </p>
                <p className="text-caption-sm text-nv-mute">
                  Confidence {(query.data.impactPreview.confidence * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-body-sm text-nv-body">{query.data.impactPreview.rationale}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {query.data.impactPreview.changedMetrics.map((metric) => (
                    <div key={metric.metric} className="border border-nv-hairline bg-nv-soft p-3">
                      <p className="text-caption-sm font-bold uppercase text-nv-mute">{metric.label}</p>
                      <p className="mt-1 text-body-strong font-bold">
                        {formatMetricValue(metric.previousValue, metric.unit)} {'->'}{' '}
                        {formatMetricValue(metric.projectedValue, metric.unit)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <Button
                    icon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
                    disabled={!query.data.canApplySnapshot || mutation.isPending}
                    onClick={() => void applyScenario()}
                  >
                    Apply as scenario snapshot
                  </Button>
                  {message && <p className="text-body-sm font-bold text-nv-success">{message}</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
