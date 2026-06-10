import { NextResponse } from 'next/server'
import {
  assertPdfFileWithinOpenAILimit,
  extractDocumentWithOpenAI,
  extractPdfFileWithOpenAI,
  isFallbackEligiblePdfError,
  isOpenAIConfigured,
  type ExtractionResult,
} from '@/lib/extraction/ruleExtractor'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { upsertExtractedRules } from '@/lib/supabase/queries/triggers'
import type { TriggerRule } from '@/lib/types/trigger'

export const runtime = 'nodejs'

interface ExtractRequest {
  documentText: string
  dealId: string
  extractDealMetadata?: boolean
  pdfFallback?: {
    bytes: Uint8Array
    filename: string
    mimeType: string
    localParserError: string
  }
}

function isExtractRequest(value: unknown): value is ExtractRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.documentText === 'string' && typeof candidate.dealId === 'string'
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
}

function pdfFallbackRequest(file: File, bytes: Uint8Array, cause: unknown): ExtractRequest['pdfFallback'] {
  return {
    bytes,
    filename: file.name || 'document.pdf',
    mimeType: file.type || 'application/pdf',
    localParserError: errorMessage(cause),
  }
}

async function parsePdf(bytes: Uint8Array) {
  const { extractText } = await import('unpdf')
  const { text } = await extractText(bytes, {
    mergePages: true,
  })
  return text
}

async function readExtractRequest(request: Request): Promise<ExtractRequest | NextResponse> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const dealId = form.get('dealId')
    const documentText = form.get('documentText')
    const file = form.get('file')
    const extractDealMetadata = form.get('extractDealMetadata') === 'true'

    if (typeof dealId !== 'string') {
      return NextResponse.json({ error: 'dealId is required.' }, { status: 400 })
    }

    if (file instanceof File && file.size > 0) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

      if (isPdf) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        try {
          const text = await parsePdf(bytes)
          if (text.trim()) return { dealId, documentText: text, extractDealMetadata }

          return {
            dealId,
            documentText: '',
            extractDealMetadata,
            pdfFallback: pdfFallbackRequest(
              file,
              bytes,
              new Error('No readable text was found in the uploaded PDF.'),
            ),
          }
        } catch (cause) {
          if (isFallbackEligiblePdfError(cause)) {
            return {
              dealId,
              documentText: '',
              extractDealMetadata,
              pdfFallback: pdfFallbackRequest(file, bytes, cause),
            }
          }
          throw new Error(
            'Could not read this PDF — it may be scanned images or corrupt. Paste the document text instead.',
          )
        }
      }

      const text = await file.text()
      return { dealId, documentText: text, extractDealMetadata }
    }

    if (typeof documentText === 'string' && documentText.trim()) {
      return { dealId, documentText, extractDealMetadata }
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
  let body: ExtractRequest | NextResponse
  try {
    body = await readExtractRequest(request)
  } catch (cause) {
    // PDF parsing (password-protected / corrupt) and request parsing failures.
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : 'Could not read the uploaded document.' },
      { status: 422 },
    )
  }
  if (body instanceof NextResponse) return body

  if (!body.documentText.trim() && !body.pdfFallback) {
    return NextResponse.json(
      {
        error:
          'No readable text was found in the document. A scanned or image-only PDF cannot be parsed — paste the text instead.',
      },
      { status: 422 },
    )
  }

  let result: ExtractionResult
  try {
    if (body.pdfFallback && !body.documentText.trim()) {
      if (!isOpenAIConfigured()) {
        return NextResponse.json(
          {
            error:
              `Local PDF text parsing failed: ${body.pdfFallback.localParserError}. ` +
              'AI PDF fallback is unavailable because OPENAI_API_KEY is not configured. ' +
              'Add OPENAI_API_KEY to .env.local, upload an unlocked PDF, or paste the document text.',
          },
          { status: 422 },
        )
      }

      try {
        assertPdfFileWithinOpenAILimit(body.pdfFallback.bytes.byteLength)
      } catch (cause) {
        return NextResponse.json(
          { error: cause instanceof Error ? cause.message : 'PDF is too large for AI PDF fallback.' },
          { status: 413 },
        )
      }

      try {
        result = await extractPdfFileWithOpenAI(body.pdfFallback.bytes, {
          extractDealMetadata: body.extractDealMetadata,
          filename: body.pdfFallback.filename,
          mimeType: body.pdfFallback.mimeType,
        })
      } catch (cause) {
        return NextResponse.json(
          {
            error:
              `Local PDF text parsing failed: ${body.pdfFallback.localParserError}. ` +
              `AI PDF fallback failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          },
          { status: 502 },
        )
      }
    } else {
      result = await extractDocumentWithOpenAI(body.documentText, {
        extractDealMetadata: body.extractDealMetadata,
      })
    }
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error ? `AI extraction failed: ${cause.message}` : 'AI extraction failed.',
      },
      { status: 502 },
    )
  }
  const { dealMetadata, closingSnapshot, rules: candidates } = result

  // Deal-intake extraction: the deal does not exist yet, so return drafts
  // without persisting. The client creates the deal, then bulk-upserts rules
  // and the closing snapshot.
  if (body.extractDealMetadata) {
    return NextResponse.json({ dealMetadata, closingSnapshot, candidates, count: candidates.length })
  }

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
