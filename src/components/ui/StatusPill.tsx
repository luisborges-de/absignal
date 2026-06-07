import { cn } from '@/lib/utils'
import type { TriggerStatus } from '@/lib/types/trigger'

interface StatusPillProps {
  status: TriggerStatus
  className?: string
}

const variants: Record<TriggerStatus, string> = {
  SAFE: 'border-nv-success/30 bg-nv-success/10 text-nv-success',
  WATCH: 'border-nv-warning/30 bg-nv-warning/10 text-nv-warning',
  BREACH: 'border-nv-error/30 bg-nv-error/10 text-nv-error',
  'N/A': 'border-nv-hairline bg-nv-soft text-nv-stone',
}

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm border px-2.5 py-1 text-[14px] font-bold',
        variants[status],
        className,
      )}
    >
      {status}
    </span>
  )
}
