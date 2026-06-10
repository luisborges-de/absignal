'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DealWorkspaceShell } from '@/components/deals/DealWorkspaceShell'
import {
  DocumentUploader,
  type ExtractionDocument,
} from '@/components/extraction/DocumentUploader'
import { ExtractionReviewPanel } from '@/components/extraction/ExtractionReviewPanel'
import { Card } from '@/components/ui/Card'
import { useDeal } from '@/hooks/useDeals'
import {
  triggerKeys,
  useTriggerRules,
  useUpdateTriggerRuleStatus,
} from '@/hooks/useTriggerRules'
import { useUIStore } from '@/store/uiStore'

export default function ExtractionPage({ params }: { params: { dealId: string } }) {
  const deal = useDeal(params.dealId)
  const rules = useTriggerRules(params.dealId)
  const updateStatus = useUpdateTriggerRuleStatus(params.dealId)
  const isExtracting = useUIStore((state) => state.isExtracting)
  const setExtracting = useUIStore((state) => state.setExtracting)
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  async function extract(document: ExtractionDocument) {
    setExtracting(true)
    setError(null)
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
      <DealWorkspaceShell dealId={params.dealId}>
        <Card className="min-h-[420px] animate-pulse" />
      </DealWorkspaceShell>
    )
  }

  return (
    <DealWorkspaceShell dealId={params.dealId}>
      <div className="grid gap-6 lg:grid-cols-[0.4fr_0.6fr]">
        <DocumentUploader onExtract={extract} isExtracting={isExtracting} />
        <ExtractionReviewPanel
          rules={rules.data ?? []}
          onApprove={(ruleId) => updateStatus.mutate({ ruleId, status: 'APPROVED' })}
          onReject={(ruleId) => updateStatus.mutate({ ruleId, status: 'REJECTED' })}
        />
      </div>
    </DealWorkspaceShell>
  )
}
