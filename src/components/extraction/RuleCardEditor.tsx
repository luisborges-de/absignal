'use client'

import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { TriggerRule } from '@/lib/types/trigger'

interface RuleCardEditorProps {
  rule: TriggerRule
  onApprove: (ruleId: string) => void
  onReject: (ruleId: string) => void
}

export function RuleCardEditor({ rule, onApprove, onReject }: RuleCardEditorProps) {
  const lowConfidence = rule.extractionConfidence < 0.5
  const rejected = rule.extractionStatus === 'REJECTED'

  return (
    <Card
      className={cn(
        'transition-colors',
        lowConfidence && 'border-nv-warning bg-nv-warning/10',
        rejected && 'opacity-60',
      )}
      cornerPosition="bottom-0 right-0"
    >
      <div className={cn(rejected && 'line-through')}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-caption-md font-bold uppercase text-nv-mute">{rule.family.replaceAll('_', ' ')}</p>
            <h3 className="mt-1 text-card-title font-bold">{rule.name}</h3>
          </div>
          <Badge variant={lowConfidence ? 'warning' : 'success'}>
            {(rule.extractionConfidence * 100).toFixed(0)}%
          </Badge>
        </div>
        <p className="text-body-sm text-nv-body">{rule.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-caption-sm text-nv-body">
          <span>Metric: {rule.metricKey}</span>
          <span>Operator: {rule.operator}</span>
          <span>Threshold: {rule.threshold ?? 'N/A'} {rule.thresholdUnit}</span>
          <span>Lookback: {rule.lookbackPeriods}</span>
        </div>
        <p className="mt-4 border-l-2 border-nv-green pl-3 text-caption-sm text-nv-mute">{rule.sourceText}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          variant="outline"
          icon={<Check className="h-4 w-4" aria-hidden="true" />}
          onClick={() => onApprove(rule.id)}
          disabled={rule.extractionStatus === 'APPROVED'}
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          icon={<X className="h-4 w-4" aria-hidden="true" />}
          onClick={() => onReject(rule.id)}
          disabled={rejected}
        >
          Reject
        </Button>
      </div>
    </Card>
  )
}
