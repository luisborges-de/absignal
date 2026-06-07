import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { Deal } from '@/lib/types/deal'
import type { PerformanceSnapshot } from '@/lib/types/performance'

interface DealHeaderProps {
  deal: Deal
  latestSnapshot?: PerformanceSnapshot
}

export function DealHeader({ deal, latestSnapshot }: DealHeaderProps) {
  const stats = [
    ['Issuance', formatCurrency(deal.totalIssuance)],
    ['Assets', `${deal.assetCount} data centers`],
    ['Occupancy', formatPercent(latestSnapshot?.occupancyRate)],
    ['LTV', formatPercent(latestSnapshot?.ltv ?? deal.ltv)],
  ]

  return (
    <section className="bg-nv-soft py-8">
      <div className="mx-auto max-w-content px-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge>{deal.ratingAgency}</Badge>
              <Badge variant="success">{deal.rating}</Badge>
              <Badge>{deal.status}</Badge>
            </div>
            <h1 className="max-w-4xl text-display-lg font-bold text-nv-ink">{deal.name}</h1>
            <p className="mt-3 text-body-md text-nv-body">
              ARD {new Date(deal.arDate).toLocaleDateString('en-US')} - {deal.collateralDescription}
            </p>
          </div>
          <div className="grid min-w-[360px] grid-cols-2 gap-3">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-sm border border-nv-hairline bg-nv-canvas p-4">
                <p className="text-caption-sm text-nv-mute">{label}</p>
                <p className="mt-1 text-body-strong font-bold text-nv-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
