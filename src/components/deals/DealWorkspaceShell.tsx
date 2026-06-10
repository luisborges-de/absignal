'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, FileSearch, GitBranch, LayoutDashboard } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/Badge'
import { useDeal } from '@/hooks/useDeals'
import { useEvaluations } from '@/hooks/useEvaluations'
import { useSnapshots } from '@/hooks/useSnapshots'
import { useTriggerRules } from '@/hooks/useTriggerRules'
import { resolveWaterfallState } from '@/lib/engine/triggerEngine'
import { getDealWorkspaceItems } from '@/lib/workspace/dealWorkspaceNavigation'
import { cn, formatCurrency, formatPercent, formatRatio } from '@/lib/utils'
import type { ReactNode } from 'react'

const iconByLabel = {
  Overview: LayoutDashboard,
  'Covenant Review': FileSearch,
  Performance: BarChart3,
  Waterfall: GitBranch,
} as const

function stateTone(state: string) {
  if (state === 'CASH_TRAP') return 'text-nv-warning'
  if (state === 'EARLY_AMORTISATION') return 'text-nv-error'
  return 'text-nv-green'
}

export function DealWorkspaceShell({ dealId, children }: { dealId: string; children: ReactNode }) {
  const pathname = usePathname()
  const items = getDealWorkspaceItems(dealId, pathname)
  const deal = useDeal(dealId)
  const snapshots = useSnapshots(dealId)
  const rules = useTriggerRules(dealId)
  const ruleIds = rules.data?.map((rule) => rule.id) ?? []
  const evaluations = useEvaluations(dealId, ruleIds)
  const latestSnapshot = snapshots.data?.at(-1)
  const latestEvaluations = latestSnapshot
    ? evaluations.data?.filter((evaluation) => evaluation.snapshotId === latestSnapshot.id) ?? []
    : []
  const breachCount = latestEvaluations.filter((evaluation) => evaluation.status === 'BREACH').length
  const watchCount = latestEvaluations.filter((evaluation) => evaluation.status === 'WATCH').length
  const waterfallState = resolveWaterfallState(latestEvaluations, deal.data?.arDate)
  const displayName = deal.data?.name ?? 'Selected Deal'
  const mobileNameParts = displayName.split(', ')
  const collateral = deal.data?.collateralDescription ?? 'Deal workspace'

  return (
    <PageShell constrained={false} showFooter={false}>
      <div className="min-h-[calc(100vh-64px)] bg-nv-soft pb-24 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:pb-0">
        <aside className="hidden border-r border-nv-hairline-strong bg-nv-dark text-nv-on-dark lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-64px)] lg:overflow-y-auto">
          <div className="flex min-h-full flex-col px-5 py-6">
            <div className="border border-nv-hairline-strong bg-nv-elevated p-4">
              <div className="mb-4 flex flex-wrap gap-2">
                {deal.data?.ratingAgency && <Badge className="bg-black/40">{deal.data.ratingAgency}</Badge>}
                {deal.data?.rating && (
                  <Badge variant="success" className="bg-black/40">
                    {deal.data.rating}
                  </Badge>
                )}
                {deal.data?.status && <Badge className="bg-black/40">{deal.data.status}</Badge>}
              </div>
              <h2 className="text-heading-sm font-bold">{displayName}</h2>
              <p className="mt-3 line-clamp-3 text-body-sm text-white/65">{collateral}</p>
              <div className="mt-4 flex items-center gap-2 text-caption-md font-bold uppercase text-nv-warning">
                <span className="h-2 w-2 rounded-full bg-nv-warning" />
                Demo scenario
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="border border-nv-hairline-strong bg-black/30 p-3">
                <p className="text-caption-sm text-white/55">State</p>
                <p className={cn('mt-1 text-body-strong font-bold', stateTone(waterfallState))}>
                  {waterfallState.replaceAll('_', ' ')}
                </p>
              </div>
              <div className="border border-nv-hairline-strong bg-black/30 p-3">
                <p className="text-caption-sm text-white/55">Triggers</p>
                <p className="mt-1 text-body-strong font-bold">
                  {breachCount} breach / {watchCount} watch
                </p>
              </div>
              <div className="border border-nv-hairline-strong bg-black/30 p-3">
                <p className="text-caption-sm text-white/55">DSCR</p>
                <p className="mt-1 text-body-strong font-bold">{formatRatio(latestSnapshot?.dscr)}</p>
              </div>
              <div className="border border-nv-hairline-strong bg-black/30 p-3">
                <p className="text-caption-sm text-white/55">Occupancy</p>
                <p className="mt-1 text-body-strong font-bold">{formatPercent(latestSnapshot?.occupancyRate)}</p>
              </div>
              <div className="border border-nv-hairline-strong bg-black/30 p-3">
                <p className="text-caption-sm text-white/55">LTV</p>
                <p className="mt-1 text-body-strong font-bold">
                  {formatPercent(latestSnapshot?.ltv ?? deal.data?.ltv)}
                </p>
              </div>
              <div className="border border-nv-hairline-strong bg-black/30 p-3">
                <p className="text-caption-sm text-white/55">Issuance</p>
                <p className="mt-1 text-body-strong font-bold">
                  {deal.data ? formatCurrency(deal.data.totalIssuance) : 'N/A'}
                </p>
              </div>
            </div>

            <nav className="mt-7 space-y-2" aria-label="Deal workspace">
              {items.map((item) => {
                const Icon = iconByLabel[item.desktopLabel as keyof typeof iconByLabel]

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex min-h-11 items-center gap-3 border px-3 py-2.5 text-btn-sm font-bold',
                      item.active
                        ? 'border-nv-green bg-nv-green text-black'
                        : 'border-transparent text-white/75 hover:border-nv-hairline-strong hover:text-nv-on-dark',
                    )}
                    aria-current={item.active ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.desktopLabel}
                  </Link>
                )
              })}
            </nav>

            <Link
              href="/deals"
              className="mt-auto pt-8 text-btn-sm font-bold text-white/65 hover:text-nv-on-dark"
            >
              Back to deals
            </Link>
          </div>
        </aside>

        <div className="min-w-0 overflow-x-hidden bg-nv-canvas">
          <header className="overflow-hidden border-b border-nv-hairline bg-nv-soft px-6 py-4 lg:hidden">
            <div className="flex flex-wrap items-center gap-2">
              {deal.data?.ratingAgency && <Badge>{deal.data.ratingAgency}</Badge>}
              {deal.data?.rating && <Badge variant="success">{deal.data.rating}</Badge>}
              <Badge variant={waterfallState === 'NORMAL' ? 'success' : 'warning'}>
                {waterfallState.replaceAll('_', ' ')}
              </Badge>
            </div>
            <h1 className="mt-3 max-w-[calc(100vw-48px)] whitespace-normal break-words text-heading-md font-bold text-nv-ink">
              <span className="block">{mobileNameParts[0]}</span>
              {mobileNameParts.length > 1 && <span className="block">{mobileNameParts.slice(1).join(', ')}</span>}
            </h1>
            <div className="mt-3 flex flex-wrap gap-3 text-caption-md font-bold text-nv-body">
              <span>DSCR {formatRatio(latestSnapshot?.dscr)}</span>
              <span>Occupancy {formatPercent(latestSnapshot?.occupancyRate)}</span>
              <span>{breachCount} breach</span>
              <span>{watchCount} watch</span>
            </div>
          </header>

          <section className="mx-auto min-w-0 max-w-[1280px] px-6 py-8 lg:px-8 lg:py-10">{children}</section>
        </div>

        <nav
          aria-label="Deal workspace"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-nv-hairline bg-nv-dark text-nv-on-dark shadow-sticky lg:hidden"
        >
          {items.map((item) => {
            const Icon = iconByLabel[item.desktopLabel as keyof typeof iconByLabel]

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-utility-xs font-bold uppercase',
                  item.active ? 'bg-nv-green text-black' : 'text-white/75',
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.mobileLabel}
              </Link>
            )
          })}
        </nav>
      </div>
    </PageShell>
  )
}
