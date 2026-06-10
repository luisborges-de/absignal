'use client'

import { ArrowLeft, CheckCircle2, WandSparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import {
  DocumentUploader,
  type ExtractionDocument,
} from '@/components/extraction/DocumentUploader'
import { RuleCardEditor } from '@/components/extraction/RuleCardEditor'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useCreateDeal } from '@/hooks/useDeals'
import { evaluateLocalSnapshot } from '@/lib/demo/localStore'
import { MARKETS } from '@/lib/live-signals/markets'
import { createSnapshot } from '@/lib/supabase/queries/snapshots'
import { upsertExtractedRules } from '@/lib/supabase/queries/triggers'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { cn } from '@/lib/utils'
import { DEAL_MARKETS, type DealMarket } from '@/lib/types/deal'
import type { ExtractedDealMetadata, ExtractedSnapshot } from '@/lib/extraction/ruleExtractor'
import type { PerformanceSnapshotInput } from '@/lib/types/performance'
import type { ExtractedRuleCandidate, TriggerRule } from '@/lib/types/trigger'

interface MetadataFormState {
  name: string
  issuer: string
  market: DealMarket
  totalIssuanceMn: string
  assetCount: string
  closingDate: string
  arDate: string
  collateralDescription: string
}

const emptyForm: MetadataFormState = {
  name: '',
  issuer: '',
  market: 'NORTHERN_VIRGINIA',
  totalIssuanceMn: '',
  assetCount: '',
  closingDate: '',
  arDate: '',
  collateralDescription: '',
}

function formFromMetadata(metadata: ExtractedDealMetadata): MetadataFormState {
  return {
    name: metadata.name ?? '',
    issuer: metadata.issuer ?? '',
    market: metadata.market ?? 'NORTHERN_VIRGINIA',
    totalIssuanceMn: metadata.totalIssuanceMn ? String(metadata.totalIssuanceMn) : '',
    assetCount: metadata.assetCount ? String(metadata.assetCount) : '',
    closingDate: metadata.closingDate ?? '',
    arDate: metadata.arDate ?? '',
    collateralDescription: metadata.collateralDescription ?? '',
  }
}

type SnapshotFormState = Record<string, string>

/** The closing-snapshot fields shown for analyst review, in display order. */
const SNAPSHOT_FIELDS: Array<{ key: keyof ExtractedSnapshot; label: string; type: 'date' | 'number' }> = [
  { key: 'periodDate', label: 'Cut-off Date', type: 'date' },
  { key: 'occupancyRate', label: 'Occupancy (0-1)', type: 'number' },
  { key: 'leasedCapacityMW', label: 'Leased Capacity (MW)', type: 'number' },
  { key: 'totalCapacityMW', label: 'Total Capacity (MW)', type: 'number' },
  { key: 'contractedRevenue', label: 'Contracted Revenue ($)', type: 'number' },
  { key: 'grossRevenue', label: 'Gross Revenue ($)', type: 'number' },
  { key: 'operatingExpenses', label: 'Operating Expenses ($)', type: 'number' },
  { key: 'netCashFlow', label: 'Net Cash Flow ($)', type: 'number' },
  { key: 'scheduledDebtService', label: 'Scheduled Debt Service ($)', type: 'number' },
  { key: 'seniorDebtService', label: 'Senior Debt Service ($)', type: 'number' },
  { key: 'pueRatio', label: 'PUE Ratio', type: 'number' },
  { key: 'powerCostPerKwh', label: 'Power Cost ($/kWh)', type: 'number' },
  { key: 'topTenantRevenuePct', label: 'Top Tenant % (0-1)', type: 'number' },
  { key: 'tenantCount', label: 'Tenant Count', type: 'number' },
  { key: 'weightedAvgRemainingLeaseTerm', label: 'WALT (years)', type: 'number' },
  { key: 'outstandingBalance', label: 'Outstanding Balance ($)', type: 'number' },
  { key: 'appraisedValue', label: 'Appraised Value ($)', type: 'number' },
  { key: 'seniorInterestReserveBalance', label: 'Senior Interest Reserve ($)', type: 'number' },
  { key: 'expenseReserveBalance', label: 'Expense Reserve ($)', type: 'number' },
  { key: 'requiredReserveBalance', label: 'Required Reserve ($)', type: 'number' },
]

function snapshotFormFromExtracted(snapshot: ExtractedSnapshot): SnapshotFormState {
  const state: SnapshotFormState = {}
  for (const { key } of SNAPSHOT_FIELDS) {
    const value = snapshot[key]
    state[key] = value === undefined ? '' : String(value)
  }
  return state
}

/** True when the analyst left at least one numeric metric populated. */
function snapshotHasData(form: SnapshotFormState): boolean {
  return SNAPSHOT_FIELDS.some(({ key, type }) => type === 'number' && form[key]?.trim())
}

/** Build a full PerformanceSnapshotInput; metrics the doc didn't state default to 0. */
function toSnapshotInput(form: SnapshotFormState, fallbackDate: string): PerformanceSnapshotInput {
  const num = (key: string) => Number(form[key] || 0)
  return {
    periodDate: form.periodDate || fallbackDate || new Date().toISOString().slice(0, 10),
    occupancyRate: num('occupancyRate'),
    leasedCapacityMW: num('leasedCapacityMW'),
    totalCapacityMW: num('totalCapacityMW'),
    contractedRevenue: num('contractedRevenue'),
    grossRevenue: num('grossRevenue'),
    operatingExpenses: num('operatingExpenses'),
    netCashFlow: num('netCashFlow'),
    scheduledDebtService: num('scheduledDebtService'),
    seniorDebtService: num('seniorDebtService'),
    pueRatio: num('pueRatio'),
    powerCostPerKwh: num('powerCostPerKwh'),
    topTenantRevenuePct: num('topTenantRevenuePct'),
    tenantCount: Math.round(num('tenantCount')),
    weightedAvgRemainingLeaseTerm: num('weightedAvgRemainingLeaseTerm'),
    outstandingBalance: num('outstandingBalance'),
    appraisedValue: num('appraisedValue'),
    seniorInterestReserveBalance: num('seniorInterestReserveBalance'),
    expenseReserveBalance: num('expenseReserveBalance'),
    requiredReserveBalance: num('requiredReserveBalance'),
    notes: 'Closing snapshot extracted from intake document',
    source: 'MANUAL',
  }
}

/** Ephemeral rule wrappers so the candidates render in the same card UI as the extraction page. */
function toDraftRule(candidate: ExtractedRuleCandidate, index: number, status: TriggerRule['extractionStatus']): TriggerRule {
  const timestamp = new Date().toISOString()
  return {
    ...candidate,
    id: `draft-${index}`,
    dealId: 'new',
    extractionStatus: status,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export default function NewDealPage() {
  const router = useRouter()
  const createDeal = useCreateDeal()
  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [isExtracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<MetadataFormState>(emptyForm)
  const [candidates, setCandidates] = useState<ExtractedRuleCandidate[]>([])
  const [decisions, setDecisions] = useState<Record<number, 'EXTRACTED' | 'APPROVED' | 'REJECTED'>>({})
  const [snapshotForm, setSnapshotForm] = useState<SnapshotFormState>({})
  const [includeSnapshot, setIncludeSnapshot] = useState(true)
  const [isCreating, setCreating] = useState(false)

  async function extract(document: ExtractionDocument) {
    setExtracting(true)
    setError(null)
    try {
      const body =
        document.file || document.documentText.startsWith('PDF selected:')
          ? (() => {
              const formData = new FormData()
              formData.set('dealId', 'new')
              formData.set('extractDealMetadata', 'true')
              if (document.file) formData.set('file', document.file)
              else formData.set('documentText', document.documentText)
              return formData
            })()
          : JSON.stringify({
              documentText: document.documentText,
              dealId: 'new',
              extractDealMetadata: true,
            })
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(detail?.error ?? 'Extraction failed.')
      }
      const data = (await response.json()) as {
        dealMetadata: ExtractedDealMetadata
        closingSnapshot?: ExtractedSnapshot
        candidates: ExtractedRuleCandidate[]
      }
      const snapshot = data.closingSnapshot ?? {}
      setForm(formFromMetadata(data.dealMetadata ?? {}))
      setCandidates(data.candidates ?? [])
      setSnapshotForm(snapshotFormFromExtracted(snapshot))
      setIncludeSnapshot(snapshotHasData(snapshotFormFromExtracted(snapshot)))
      setDecisions({})
      setStep('review')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Extraction failed.')
    } finally {
      setExtracting(false)
    }
  }

  function update(name: keyof MetadataFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function updateSnapshot(key: string, value: string) {
    setSnapshotForm((current) => ({ ...current, [key]: value }))
  }

  async function confirmAndCreate() {
    if (!form.name.trim() || !form.issuer.trim()) {
      setError('Deal name and issuer are required.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const deal = await createDeal.mutateAsync({
        name: form.name.trim(),
        issuer: form.issuer.trim(),
        market: form.market,
        closingDate: form.closingDate || new Date().toISOString().slice(0, 10),
        arDate: form.arDate || new Date().toISOString().slice(0, 10),
        totalIssuance: Math.round(Number(form.totalIssuanceMn || 0) * 1_000_000),
        assetCount: Math.round(Number(form.assetCount || 0)),
        collateralDescription: form.collateralDescription.trim(),
      })

      // Non-rejected drafts are approved on intake so the deal is evaluated immediately.
      const kept = candidates.filter((_, index) => decisions[index] !== 'REJECTED')
      if (kept.length) {
        await upsertExtractedRules({ dealId: deal.id, candidates: kept, status: 'APPROVED' })
      }

      // Closing snapshot from the document makes the deal monitorable on creation.
      if (includeSnapshot && snapshotHasData(snapshotForm)) {
        const input = toSnapshotInput(snapshotForm, form.closingDate)
        const snapshot = await createSnapshot({ dealId: deal.id, input })
        if (isSupabaseConfigured()) {
          await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: deal.id, snapshotId: snapshot.id, snapshot }),
          })
        } else {
          evaluateLocalSnapshot(deal.id, snapshot)
        }
      }

      router.push(`/deals/${deal.id}/performance`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Deal creation failed.')
      setCreating(false)
    }
  }

  return (
    <PageShell showDemoBanner>
      <section className="space-y-6 py-section">
        <div>
          <p className="text-caption-md font-bold uppercase text-nv-mute">New Deal</p>
          <h1 className="mt-2 text-display-lg font-bold">AI-prefilled deal intake</h1>
          <p className="mt-3 max-w-3xl text-body-md text-nv-body">
            Upload a presale report or indenture (PDF) and AI drafts the deal record, covenant
            ruleset, and a closing snapshot in one pass. An analyst reviews and confirms everything
            before the deal goes live.
          </p>
        </div>

        {step === 'upload' && (
          <div className="grid gap-6 lg:grid-cols-[0.5fr_0.5fr]">
            <DocumentUploader
              onExtract={extract}
              isExtracting={isExtracting}
              title="Presale or Indenture"
              ctaLabel="Draft Deal with AI"
            />
            <Card className="flex min-h-[420px] items-center justify-center text-center">
              <div className="max-w-sm">
                <WandSparkles className="mx-auto h-8 w-8 text-nv-green" aria-hidden="true" />
                <h2 className="mt-4 text-heading-xl font-bold">The form is never blank</h2>
                <p className="mt-3 text-body-sm text-nv-body">
                  AI produces a first-pass extraction of deal metadata, covenant triggers, and the
                  closing snapshot in seconds. You review, edit, and approve before anything is
                  created. Presale reports extract cleanest; large indentures are auto-trimmed to
                  their covenant and waterfall sections.
                </p>
              </div>
            </Card>
          </div>
        )}

        {step === 'review' && (
          <div className="grid gap-6 lg:grid-cols-[0.45fr_0.55fr]">
            <div className="space-y-6">
            <Card className="h-fit">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-caption-md font-bold uppercase text-nv-mute">Step 2 of 2</p>
                  <h2 className="mt-1 text-heading-xl font-bold">Review deal draft</h2>
                </div>
                <Button
                  variant="ghost"
                  icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setStep('upload')}
                >
                  Back
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input label="Deal Name" value={form.name} onChange={(event) => update('name', event.target.value)} />
                </div>
                <Input label="Issuer" value={form.issuer} onChange={(event) => update('issuer', event.target.value)} />
                <label className="block">
                  <span className="mb-2 block text-caption-md font-bold uppercase text-nv-body">Market</span>
                  <select
                    value={form.market}
                    onChange={(event) => update('market', event.target.value)}
                    className="h-11 w-full rounded-sm border border-nv-hairline bg-nv-canvas px-4 text-body-md text-nv-ink outline-none focus:border-2 focus:border-nv-green"
                  >
                    {DEAL_MARKETS.map((market) => (
                      <option key={market} value={market}>
                        {MARKETS[market].label}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Total Issuance ($M)"
                  type="number"
                  value={form.totalIssuanceMn}
                  onChange={(event) => update('totalIssuanceMn', event.target.value)}
                />
                <Input
                  label="Asset Count"
                  type="number"
                  value={form.assetCount}
                  onChange={(event) => update('assetCount', event.target.value)}
                />
                <Input
                  label="Closing Date"
                  type="date"
                  value={form.closingDate}
                  onChange={(event) => update('closingDate', event.target.value)}
                />
                <Input
                  label="AR Date"
                  type="date"
                  value={form.arDate}
                  onChange={(event) => update('arDate', event.target.value)}
                />
              </div>
              <label className="mt-4 block">
                <span className="mb-2 block text-caption-md font-bold uppercase text-nv-body">Collateral Description</span>
                <textarea
                  value={form.collateralDescription}
                  onChange={(event) => update('collateralDescription', event.target.value)}
                  className="min-h-24 w-full rounded-sm border border-nv-hairline bg-nv-canvas p-3 text-body-sm text-nv-ink outline-none focus:border-2 focus:border-nv-green"
                />
              </label>
            </Card>

            <Card className="h-fit">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-caption-md font-bold uppercase text-nv-mute">From the document</p>
                  <h3 className="mt-1 text-heading-lg font-bold">Closing snapshot</h3>
                </div>
                <label className="flex items-center gap-2 text-body-sm font-bold text-nv-body">
                  <input
                    type="checkbox"
                    checked={includeSnapshot}
                    onChange={(event) => setIncludeSnapshot(event.target.checked)}
                  />
                  Include
                </label>
              </div>
              <p className="mb-4 text-body-sm text-nv-body">
                Pool metrics as of the cut-off date, extracted from the document. Leave a field blank
                if it wasn&apos;t stated — blanks store as 0. This single snapshot makes the deal
                monitorable on creation; add ongoing periods later via CSV import.
              </p>
              <div className={cn('grid gap-3 sm:grid-cols-2', !includeSnapshot && 'opacity-50')}>
                {SNAPSHOT_FIELDS.map(({ key, label, type }) => (
                  <Input
                    key={key}
                    label={label}
                    type={type}
                    value={snapshotForm[key] ?? ''}
                    disabled={!includeSnapshot}
                    onChange={(event) => updateSnapshot(key, event.target.value)}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center gap-4">
                <Button
                  icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  disabled={isCreating}
                  onClick={() => void confirmAndCreate()}
                >
                  {isCreating ? 'Creating' : 'Confirm & Create Deal'}
                </Button>
              </div>
              {error && <p className="mt-4 text-body-sm font-bold text-nv-error">{error}</p>}
            </Card>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-caption-md font-bold uppercase text-nv-mute">
                  Trigger Rule Drafts ({candidates.length})
                </p>
                <p className="mt-1 text-body-sm text-nv-body">
                  Rejected drafts are discarded; everything else is saved for analyst review on the
                  extraction page.
                </p>
              </div>
              {candidates.length === 0 && (
                <Card className="flex min-h-[200px] items-center justify-center text-center">
                  <p className="text-body-sm text-nv-body">No trigger candidates extracted.</p>
                </Card>
              )}
              {candidates.map((candidate, index) => (
                <RuleCardEditor
                  key={index}
                  rule={toDraftRule(candidate, index, decisions[index] ?? 'APPROVED')}
                  onApprove={() => setDecisions((current) => ({ ...current, [index]: 'APPROVED' }))}
                  onReject={() => setDecisions((current) => ({ ...current, [index]: 'REJECTED' }))}
                />
              ))}
            </div>
          </div>
        )}

        {error && step === 'upload' && (
          <p className="text-body-sm font-bold text-nv-error">{error}</p>
        )}
      </section>
    </PageShell>
  )
}
