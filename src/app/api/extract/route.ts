import { NextResponse } from 'next/server'
import { extractRulesWithAnthropic } from '@/lib/extraction/ruleExtractor'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { upsertExtractedRules } from '@/lib/supabase/queries/triggers'
import type { TriggerRule } from '@/lib/types/trigger'

export const runtime = 'nodejs'

interface ExtractRequest {
  documentText: string
  dealId: string
}

function isExtractRequest(value: unknown): value is ExtractRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.documentText === 'string' && typeof candidate.dealId === 'string'
}

async function parsePdf(file: File) {
  const pdfParse = (await import('pdf-parse')).default
  const bytes = Buffer.from(await file.arrayBuffer())
  const parsed = await pdfParse(bytes)
  return parsed.text
}

async function readExtractRequest(request: Request): Promise<ExtractRequest | NextResponse> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const dealId = form.get('dealId')
    const documentText = form.get('documentText')
    const file = form.get('file')

    if (typeof dealId !== 'string') {
      return NextResponse.json({ error: 'dealId is required.' }, { status: 400 })
    }

    if (file instanceof File && file.size > 0) {
      const text =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
          ? await parsePdf(file)
          : await file.text()
      return { dealId, documentText: text }
    }

    if (typeof documentText === 'string' && documentText.trim()) {
      return { dealId, documentText }
    }

    return NextResponse.json({ error: 'A text document or file is required.' }, { status: 400 })
  }

  const body = (await request.json()) as unknown
  if (!isExtractRequest(body)) {
    return NextResponse.json({ error: 'documentText and dealId are required.' }, { status: 400 })
  }

  return body
}

export async function POST(request: Request) {
  const body = await readExtractRequest(request)
  if (body instanceof NextResponse) return body

  const candidates = await extractRulesWithAnthropic(body.documentText)

  if (!isSupabaseConfigured()) {
    const rules = await upsertExtractedRules({ dealId: body.dealId, candidates })
    return NextResponse.json({ rules, count: rules.length })
  }

  if (isSupabaseConfigured()) {
    const supabase = createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const timestamp = new Date().toISOString()
    const rules: TriggerRule[] = candidates.map((candidate) => ({
      id: globalThis.crypto.randomUUID(),
      dealId: body.dealId,
      family: candidate.family,
      name: candidate.name,
      description: candidate.description,
      metricKey: candidate.metricKey,
      operator: candidate.operator,
      threshold: candidate.threshold,
      thresholdUnit: candidate.thresholdUnit,
      lookbackPeriods: candidate.lookbackPeriods,
      consequence: candidate.consequence,
      sectionReference: candidate.sectionReference,
      sourceText: candidate.sourceText,
      extractionStatus: 'EXTRACTED',
      extractionConfidence: candidate.extractionConfidence,
      watchBuffer: candidate.watchBuffer,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    const service = createServiceClient()
    const { error } = await service.from('trigger_rules').upsert(
      rules.map((rule) => ({
        id: rule.id,
        deal_id: rule.dealId,
        family: rule.family,
        name: rule.name,
        description: rule.description,
        metric_key: rule.metricKey,
        operator: rule.operator,
        threshold: rule.threshold,
        threshold_unit: rule.thresholdUnit,
        lookback_periods: rule.lookbackPeriods,
        consequence: rule.consequence,
        section_reference: rule.sectionReference,
        source_text: rule.sourceText,
        extraction_status: rule.extractionStatus,
        extraction_confidence: rule.extractionConfidence,
        watch_buffer: rule.watchBuffer,
        active: rule.active,
        created_at: rule.createdAt,
        updated_at: rule.updatedAt,
      })),
      { onConflict: 'id' },
    )
    if (error) throw error
    return NextResponse.json({ rules, count: rules.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed.' },
      { status: 500 },
    )
  }
}
