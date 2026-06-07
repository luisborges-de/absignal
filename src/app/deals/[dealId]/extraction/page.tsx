'use client'

import { useQueryClient } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { DealHeader } from '@/components/deals/DealHeader'
import { DealSubNav } from '@/components/deals/DealSubNav'
import {
  DocumentUploader,
  type ExtractionDocument,
} from '@/components/extraction/DocumentUploader'
import { ExtractionReviewPanel } from '@/components/extraction/ExtractionReviewPanel'
import { Card } from '@/components/ui/Card'
import { useDeal } from '@/hooks/useDeals'
import { useSnapshots } from '@/hooks/useSnapshots'
import {
  triggerKeys,
  useTriggerRules,
  useUpdateTriggerRuleStatus,
} from '@/hooks/useTriggerRules'
import { useUIStore } from '@/store/uiStore'

export default function ExtractionPage({ params }: { params: { dealId: string } }) {
  const deal = useDeal(params.dealId)
  const snapshots = useSnapshots(params.dealId)
  const rules = useTriggerRules(params.dealId)
  const updateStatus = useUpdateTriggerRuleStatus(params.dealId)
  const isExtracting = useUIStore((state) => state.isExtracting)
  const setExtracting = useUIStore((state) => state.setExtracting)
  const queryClient = useQueryClient()

  async function extract(document: ExtractionDocument) {
    setExtracting(true)
    try {
      const body =
        document.file || document.documentText.startsWith('PDF selected:')
          ? (() => {
              const form = new FormData()
              form.set('dealId', params.dealId)
              if (document.file) form.set('file', document.file)
              else form.set('documentText', document.documentText)
              return form
            })()
          : JSON.stringify({ documentText: document.documentText, dealId: params.dealId })
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })
      if (!response.ok) throw new Error('Extraction failed.')
      await queryClient.invalidateQueries({ queryKey: triggerKeys.all(params.dealId) })
    } finally {
      setExtracting(false)
    }
  }

  if (!deal.data) {
    return (
      <PageShell showDemoBanner>
        <section className="py-section">
          <Card className="min-h-[420px] animate-pulse" />
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell constrained={false} showDemoBanner>
      <DealHeader deal={deal.data} latestSnapshot={snapshots.data?.at(-1)} />
      <DealSubNav dealId={params.dealId} />
      <section className="mx-auto grid max-w-content gap-6 px-6 py-section lg:grid-cols-[0.4fr_0.6fr]">
        <DocumentUploader onExtract={extract} isExtracting={isExtracting} />
        <ExtractionReviewPanel
          rules={rules.data ?? []}
          onApprove={(ruleId) => updateStatus.mutate({ ruleId, status: 'APPROVED' })}
          onReject={(ruleId) => updateStatus.mutate({ ruleId, status: 'REJECTED' })}
        />
      </section>
    </PageShell>
  )
}
