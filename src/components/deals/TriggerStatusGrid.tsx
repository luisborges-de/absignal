'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { useEvaluations } from '@/hooks/useEvaluations'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useTriggerRules } from '@/hooks/useTriggerRules'
import { BRAND_NAME } from '@/lib/brand'
import { cn, formatPercent, formatRatio } from '@/lib/utils'
import type { Deal } from '@/lib/types/deal'
import type { TriggerEvaluation, TriggerRule } from '@/lib/types/trigger'

function latestByRule(evaluations: TriggerEvaluation[]) {
  const map = new Map<string, TriggerEvaluation>()

  evaluations.forEach((evaluation) => {
    const current = map.get(evaluation.ruleId)
    if (!current || new Date(evaluation.evaluatedAt).getTime() >= new Date(current.evaluatedAt).getTime()) {
      map.set(evaluation.ruleId, evaluation)
    }
  })

  return map
}

function displayValue(rule: TriggerRule, value: number | null) {
  if (rule.thresholdUnit === 'x') return formatRatio(value)
  if (rule.thresholdUnit === '%') return formatPercent(value)
  if (rule.thresholdUnit === 'USD') return value === null ? 'N/A' : `$${value.toLocaleString()}`
  if (rule.thresholdUnit === 'years') return value === null ? 'N/A' : `${value.toFixed(1)}y`
  return value === null ? 'N/A' : value.toLocaleString()
}

function distanceLabel(value: number | null) {
  if (value === null) return 'N/A'
  if (value < 0) return `${Math.abs(value * 100).toFixed(1)}% breached`
  return `${(value * 100).toFixed(1)}% headroom`
}

function exportSummary(deal: Deal, rows: Array<{ rule: TriggerRule; evaluation?: TriggerEvaluation }>) {
  const lines = [
    `${BRAND_NAME} Surveillance Summary`,
    deal.name,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    'Trigger,Status,Current,Threshold,Distance,Consequence',
    ...rows.map(({ rule, evaluation }) =>
      [
        rule.name,
        evaluation?.status ?? 'N/A',
        displayValue(rule, evaluation?.currentValue ?? null),
        displayValue(rule, rule.threshold),
        distanceLabel(evaluation?.distanceToBreachPct ?? null),
        rule.consequence,
      ].join(','),
    ),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${deal.name.replaceAll(' ', '-').toLowerCase()}-surveillance-summary.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function TriggerStatusGrid({ deal }: { deal: Deal }) {
  const rulesQuery = useTriggerRules(deal.id)
  const snapshotsQuery = useSnapshots(deal.id)
  const ruleIds = rulesQuery.data?.map((rule) => rule.id) ?? []
  const evaluationsQuery = useEvaluations(deal.id, ruleIds)

  const rules = rulesQuery.data ?? []
  const evaluations = evaluationsQuery.data ?? []
  const latestSnapshot = snapshotsQuery.data?.at(-1)
  const byRule = latestByRule(
    latestSnapshot
      ? evaluations.filter((evaluation) => evaluation.snapshotId === latestSnapshot.id)
      : evaluations,
  )
  const rows = rules.map((rule) => ({ rule, evaluation: byRule.get(rule.id) }))

  if (rulesQuery.isLoading || evaluationsQuery.isLoading) {
    return (
      <Card className="min-h-[320px] animate-pulse">
        <div className="h-6 w-64 bg-nv-soft" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 bg-nv-soft" />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col justify-between gap-4 border-b border-nv-hairline p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-caption-md font-bold uppercase text-nv-mute">Trigger Surveillance</p>
          <h2 className="mt-1 text-heading-xl font-bold">Current Credit Rules</h2>
        </div>
        <Button
          variant="outline"
          icon={<Download className="h-4 w-4" aria-hidden="true" />}
          onClick={() => exportSummary(deal, rows)}
        >
          Export Surveillance Summary
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-body-sm">
          <thead className="bg-nv-soft text-caption-md font-bold uppercase text-nv-body">
            <tr>
              <th className="px-6 py-4">Trigger</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Current Value</th>
              <th className="px-6 py-4">Threshold</th>
              <th className="px-6 py-4">Distance</th>
              <th className="px-6 py-4">Consequence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rule, evaluation }) => {
              const distance = evaluation?.distanceToBreachPct ?? null
              const width = distance === null ? 0 : Math.min(100, Math.max(4, Math.abs(distance) * 400))

              return (
                <tr key={rule.id} className="border-t border-nv-hairline">
                  <td className="px-6 py-5">
                    <p className="font-bold">{rule.name}</p>
                    <p className="text-caption-sm text-nv-mute">{rule.sectionReference}</p>
                  </td>
                  <td className="px-6 py-5">
                    <StatusPill status={evaluation?.status ?? 'N/A'} />
                  </td>
                  <td className="px-6 py-5">{displayValue(rule, evaluation?.currentValue ?? null)}</td>
                  <td className="px-6 py-5">{displayValue(rule, rule.threshold)}</td>
                  <td className="px-6 py-5">
                    <div className="w-44">
                      <p className="mb-2 text-caption-sm text-nv-mute">{distanceLabel(distance)}</p>
                      <div className="h-2 rounded-sm bg-nv-soft">
                        <div
                          className={cn(
                            'h-2 rounded-sm',
                            distance !== null && distance < 0
                              ? 'bg-nv-error'
                              : distance !== null && distance < rule.watchBuffer
                                ? 'bg-nv-warning'
                                : 'bg-nv-success',
                          )}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold">{rule.consequence.replaceAll('_', ' ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
