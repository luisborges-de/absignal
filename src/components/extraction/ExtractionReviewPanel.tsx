'use client'

import { Card } from '@/components/ui/Card'
import { RuleCardEditor } from './RuleCardEditor'
import type { TriggerRule } from '@/lib/types/trigger'

interface ExtractionReviewPanelProps {
  rules: TriggerRule[]
  onApprove: (ruleId: string) => void
  onReject: (ruleId: string) => void
}

export function ExtractionReviewPanel({ rules, onApprove, onReject }: ExtractionReviewPanelProps) {
  if (!rules.length) {
    return (
      <Card className="flex min-h-[620px] items-center justify-center text-center">
        <div>
          <p className="text-caption-md font-bold uppercase text-nv-mute">Extraction Review</p>
          <h2 className="mt-2 text-heading-xl font-bold">No candidates yet</h2>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <RuleCardEditor key={rule.id} rule={rule} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  )
}
