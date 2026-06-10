'use client'

import { DealWorkspaceShell } from '@/components/deals/DealWorkspaceShell'
import { TriggerStatusGrid } from '@/components/deals/TriggerStatusGrid'
import { Card } from '@/components/ui/Card'
import { useDeal } from '@/hooks/useDeals'

export default function DealOverviewPage({ params }: { params: { dealId: string } }) {
  const deal = useDeal(params.dealId)

  if (deal.isLoading) {
    return (
      <DealWorkspaceShell dealId={params.dealId}>
        <Card className="min-h-[420px] animate-pulse" />
      </DealWorkspaceShell>
    )
  }

  if (!deal.data) {
    return (
      <DealWorkspaceShell dealId={params.dealId}>
        <Card>Deal not found.</Card>
      </DealWorkspaceShell>
    )
  }

  return (
    <DealWorkspaceShell dealId={params.dealId}>
      <TriggerStatusGrid deal={deal.data} />
    </DealWorkspaceShell>
  )
}
