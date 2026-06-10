/**
 * Ingests the presale PDFs in public/demo/presales/ through the real AI
 * extraction pipeline and upserts the resulting trigger rules as EXTRACTED
 * drafts for analyst review.
 *
 * Drop real presale PDFs over the placeholders (same filenames) before the
 * demo and re-run. Falls back to the heuristic extractor when OPENAI_API_KEY
 * is not configured.
 *
 * Usage: npx tsx scripts/ingest-presales.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { extractDocumentWithOpenAI } from '../src/lib/extraction/ruleExtractor'
import {
  ALIGNED_DEAL_ID,
  DEMO_DEAL_ID,
  STACK_DEAL_ID,
  SWITCH_DEAL_ID,
  VANTAGE_DEAL_ID,
  demoDeals,
} from '../src/lib/demo/seedDemo'
import type { Database } from '../src/lib/supabase/types'

const PRESALE_DIR = path.join(process.cwd(), 'public', 'demo', 'presales')

const PRESALES: { slug: string; dealId: string; idBlock: string }[] = [
  { slug: 'centersquare-2025-2', dealId: DEMO_DEAL_ID, idBlock: '91111111' },
  { slug: 'vantage-2025-1', dealId: VANTAGE_DEAL_ID, idBlock: '92111111' },
  { slug: 'aligned-2025-1', dealId: ALIGNED_DEAL_ID, idBlock: '93111111' },
  { slug: 'switch-2025-2', dealId: SWITCH_DEAL_ID, idBlock: '94111111' },
  { slug: 'stack-2025-3', dealId: STACK_DEAL_ID, idBlock: '95111111' },
]

function loadDotEnv(filePath = '.env.local') {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    const value = rest.join('=').replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

async function parsePdf(buffer: Buffer) {
  const { extractText } = await import('unpdf')
  const { text, totalPages } = await extractText(new Uint8Array(buffer), { mergePages: true })
  return { text, numpages: totalPages }
}

async function main() {
  loadDotEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey || url.startsWith('your-') || serviceRoleKey.startsWith('your-')) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  }

  const service = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const presale of PRESALES) {
    const filePath = path.join(PRESALE_DIR, `${presale.slug}.pdf`)
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping ${presale.slug}: ${filePath} not found. Run make-placeholder-pdfs.ts first.`)
      continue
    }

    const deal = demoDeals.find((item) => item.id === presale.dealId)
    const buffer = fs.readFileSync(filePath)
    const parsed = await parsePdf(buffer)
    const text = parsed.text.trim()
    const estimatedTokens = Math.ceil(text.length / 4)
    console.log(
      `\n${presale.slug} -> ${deal?.name ?? presale.dealId}\n` +
        `  pages: ${parsed.numpages}, chars: ${text.length}, ~tokens: ${estimatedTokens}`,
    )

    const { dealMetadata, rules } = await extractDocumentWithOpenAI(text, {
      extractDealMetadata: true,
    })
    console.log(`  extracted metadata: ${JSON.stringify(dealMetadata)}`)
    console.log(`  extracted ${rules.length} candidate rules`)

    // Deterministic ids keyed on the presale slug keep re-runs idempotent.
    const timestamp = new Date().toISOString()
    const rows = rules.map((candidate, index) => ({
      id: `${presale.idBlock}-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      deal_id: presale.dealId,
      family: candidate.family,
      name: candidate.name,
      description: candidate.description,
      metric_key: candidate.metricKey,
      operator: candidate.operator,
      threshold: candidate.threshold,
      threshold_unit: candidate.thresholdUnit,
      lookback_periods: candidate.lookbackPeriods,
      consequence: candidate.consequence,
      section_reference: candidate.sectionReference,
      source_text: candidate.sourceText,
      extraction_status: 'EXTRACTED' as const,
      extraction_confidence: candidate.extractionConfidence,
      watch_buffer: candidate.watchBuffer,
      active: true,
      created_at: timestamp,
      updated_at: timestamp,
    }))

    if (rows.length) {
      const { error } = await service.from('trigger_rules').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(`${presale.slug}: upsert rules failed: ${error.message}`)
      console.log(`  upserted ${rows.length} EXTRACTED drafts for analyst review`)
    }
  }

  console.log('\nPresale ingest complete.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
