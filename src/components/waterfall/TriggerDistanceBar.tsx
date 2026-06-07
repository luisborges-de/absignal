import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { cn } from '@/lib/utils'
import type { TriggerEvaluation, TriggerRule } from '@/lib/types/trigger'

interface TriggerDistanceBarProps {
  rule: TriggerRule
  evaluation?: TriggerEvaluation
}

export function TriggerDistanceBar({ rule, evaluation }: TriggerDistanceBarProps) {
  const distance = evaluation?.distanceToBreachPct ?? null
  const width = distance === null ? 0 : Math.min(100, Math.max(4, Math.abs(distance) * 400))

  return (
    <Card className="p-5" cornerPosition="bottom-0 right-0">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-caption-sm text-nv-mute">{rule.family.replaceAll('_', ' ')}</p>
          <h3 className="text-card-title font-bold">{rule.name}</h3>
        </div>
        <StatusPill status={evaluation?.status ?? 'N/A'} />
      </div>
      <div className="h-3 rounded-sm bg-nv-soft">
        <div
          className={cn(
            'h-3 rounded-sm',
            distance !== null && distance < 0
              ? 'bg-nv-error'
              : distance !== null && distance < rule.watchBuffer
                ? 'bg-nv-warning'
                : 'bg-nv-success',
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-3 text-caption-sm text-nv-mute">
        {distance === null
          ? 'N/A'
          : distance < 0
            ? `${Math.abs(distance * 100).toFixed(1)}% through threshold`
            : `${(distance * 100).toFixed(1)}% headroom`}
      </p>
    </Card>
  )
}
