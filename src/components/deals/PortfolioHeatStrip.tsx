'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { useDeals } from '@/hooks/useDeals'
import { snapshotKeys } from '@/hooks/useSnapshots'
import { triggerKeys } from '@/hooks/useTriggerRules'
import { evaluateAllTriggers, resolveWaterfallState } from '@/lib/engine/triggerEngine'
import { MARKETS } from '@/lib/live-signals/markets'
import { getSnapshots } from '@/lib/supabase/queries/snapshots'
import { getTriggerRules } from '@/lib/supabase/queries/triggers'
import { cn } from '@/lib/utils'
import type { Deal, WaterfallStateType } from '@/lib/types/deal'
import type { TriggerEvaluation, TriggerStatus } from '@/lib/types/trigger'

interface DealHeat {
  deal: Deal
  status: TriggerStatus
  waterfallState: WaterfallStateType
  worstEvaluation: TriggerEvaluation | null
  worstRuleName: string | null
}

const STATUS_RANK: Record<TriggerStatus, number> = { BREACH: 0, WATCH: 1, SAFE: 2, 'N/A': 3 }

function statusClasses(status: TriggerStatus) {
  if (status === 'BREACH') return 'border-trigger-breach bg-trigger-breach/10'
  if (status === 'WATCH') return 'border-trigger-watch bg-trigger-watch/10'
  if (status === 'SAFE') return 'border-trigger-safe bg-trigger-safe/10'
  return 'border-nv-hairline bg-nv-soft'
}

function statusTextClass(status: TriggerStatus) {
  if (status === 'BREACH') return 'text-trigger-breach'
  if (status === 'WATCH') return 'text-trigger-watch'
  if (status === 'SAFE') return 'text-trigger-safe'
  return 'text-nv-mute'
}

function shortName(deal: Deal) {
  return deal.name.split(',')[0]
}

export function PortfolioHeatStrip() {
  const deals = useDeals()
  const dealList = deals.data ?? []

  // Two-phase loading: rules and snapshots per deal resolve first, evaluations
  // are then computed client-side with the deterministic trigger engine.
  const ruleQueries = useQueries({
    queries: dealList.map((deal) => ({
      queryKey: triggerKeys.all(deal.id),
      queryFn: () => getTriggerRules(deal.id),
      enabled: Boolean(deal.id),
    })),
  })
  const snapshotQueries = useQueries({
    queries: dealList.map((deal) => ({
      queryKey: snapshotKeys.all(deal.id),
      queryFn: () => getSnapshots(deal.id),
      enabled: Boolean(deal.id),
    })),
  })

  const heats: DealHeat[] = dealList.map((deal, index) => {
    const rules = (ruleQueries[index]?.data ?? []).filter(
      (rule) => rule.active && rule.extractionStatus === 'APPROVED',
    )
    const snapshots = snapshotQueries[index]?.data ?? []

    if (!rules.length || !snapshots.length) {
      return { deal, status: 'N/A', waterfallState: 'NORMAL', worstEvaluation: null, worstRuleName: null }
    }

    const evaluations = evaluateAllTriggers(rules, snapshots)
    const scored = evaluations.filter(
      (evaluation) => evaluation.status !== 'N/A' && evaluation.distanceToBreachPct !== null,
    )
    const worst = scored.length
      ? scored.reduce((min, evaluation) =>
          (evaluation.distanceToBreachPct ?? Infinity) < (min.distanceToBreachPct ?? Infinity)
            ? evaluation
            : min,
        )
      : null
    const status: TriggerStatus = evaluations.some((evaluation) => evaluation.status === 'BREACH')
      ? 'BREACH'
      : evaluations.some((evaluation) => evaluation.status === 'WATCH')
        ? 'WATCH'
        : 'SAFE'
    const worstRule = worst ? rules.find((rule) => rule.id === worst.ruleId) : null

    return {
      deal,
      status,
      waterfallState: resolveWaterfallState(evaluations, deal.arDate),
      worstEvaluation: worst,
      worstRuleName: worstRule?.name ?? null,
    }
  })

  const ranked = [...heats].sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) {
      return STATUS_RANK[a.status] - STATUS_RANK[b.status]
    }
    return (
      (a.worstEvaluation?.distanceToBreachPct ?? Infinity) -
      (b.worstEvaluation?.distanceToBreachPct ?? Infinity)
    )
  })

  if (!dealList.length) return null

  return (
    <div className="mb-8">
      <p className="flex items-center gap-2 text-caption-md font-bold uppercase text-nv-mute">
        <Flame className="h-4 w-4 text-nv-green" aria-hidden="true" />
        Portfolio Heat — ranked by distance to breach
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ranked.map(({ deal, status, waterfallState, worstEvaluation, worstRuleName }) => (
          <Link
            key={deal.id}
            href={`/deals/${deal.id}/performance`}
            className={cn(
              'block border-2 p-3 transition-colors hover:border-nv-green',
              statusClasses(status),
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-caption-sm font-bold uppercase text-nv-mute">
                {MARKETS[deal.market].label}
              </p>
              <span className={cn('text-utility-xs font-bold uppercase', statusTextClass(status))}>
                {status}
              </span>
            </div>
            <p className="mt-1 truncate text-body-strong font-bold" title={deal.name}>
              {shortName(deal)}
            </p>
            {worstEvaluation && worstEvaluation.distanceToBreachPct !== null ? (
              <p className={cn('mt-2 text-caption-sm font-bold', statusTextClass(status))}>
                {worstEvaluation.distanceToBreachPct < 0
                  ? `${Math.abs(worstEvaluation.distanceToBreachPct * 100).toFixed(1)}% past ${worstRuleName ?? 'trigger'}`
                  : `${(worstEvaluation.distanceToBreachPct * 100).toFixed(1)}% to ${worstRuleName ?? 'trigger'}`}
              </p>
            ) : (
              <p className="mt-2 text-caption-sm text-nv-mute">No evaluations yet</p>
            )}
            {waterfallState !== 'NORMAL' && (
              <p className="mt-1 text-utility-xs font-bold uppercase text-nv-error">
                {waterfallState.replaceAll('_', ' ')}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
