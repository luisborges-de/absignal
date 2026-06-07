import Link from 'next/link'
import { AlertTriangle, CalendarClock, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusPill } from '@/components/ui/StatusPill'
import { daysUntil, formatCurrency, formatPercent, formatRatio } from '@/lib/utils'
import type { Deal, WaterfallStateType } from '@/lib/types/deal'
import type { PerformanceSnapshot } from '@/lib/types/performance'
import type { TriggerStatus } from '@/lib/types/trigger'

interface DealCardProps {
  deal: Deal
  snapshot?: PerformanceSnapshot
  waterfallState: WaterfallStateType
  status: TriggerStatus
}

export function DealCard({ deal, snapshot, waterfallState, status }: DealCardProps) {
  return (
    <Link href={`/deals/${deal.id}`} className="block">
      <Card className="flex h-full min-h-[280px] flex-col justify-between">
        <div>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-caption-md font-bold uppercase text-nv-mute">{deal.issuer}</p>
              <h2 className="mt-2 text-card-title font-bold text-nv-ink">{deal.name}</h2>
            </div>
            <StatusPill status={status} />
          </div>
          <p className="text-body-sm text-nv-body">{deal.collateralDescription}</p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 text-body-sm">
          <div>
            <p className="text-caption-sm text-nv-mute">Issuance</p>
            <p className="font-bold">{formatCurrency(deal.totalIssuance)}</p>
          </div>
          <div>
            <p className="text-caption-sm text-nv-mute">State</p>
            <p className="font-bold">{waterfallState.replaceAll('_', ' ')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-nv-green" aria-hidden="true" />
            <span>{formatRatio(snapshot?.dscr)}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-nv-warning" aria-hidden="true" />
            <span>{formatPercent(snapshot?.occupancyRate)}</span>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-nv-stone" aria-hidden="true" />
            <span>{daysUntil(deal.arDate)} days to ARD</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
