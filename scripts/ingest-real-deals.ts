/**
 * Ingests the real data-center ABS source documents in public/demo/presales/real/
 * through the SAME extraction pipeline the app's /deals/new flow uses
 * (extractDocumentWithOpenAI with extractDealMetadata), then persists each as a
 * real, monitorable deal in Supabase:
 *   - deal record (is_demo = false, owned by the demo user so RLS exposes it)
 *   - approved trigger rules (extracted from the document)
 *   - a closing performance snapshot (real disclosed metrics + modeled fills)
 *   - trigger evaluations for that snapshot
 *
 * Documents are assembled from public KBRA / DBRS / Scope / Asset Securitization
 * Report disclosures. Where a figure is not publicly disclosed for these 144A
 * deals (debt service, occupancy), a realistic value consistent with the
 * disclosed envelope is used and noted in the snapshot `notes` field.
 *
 * Idempotent: deterministic UUIDs mean re-running upserts in place.
 *
 * Usage: npx tsx scripts/ingest-real-deals.ts
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { extractDocumentWithOpenAI } from '../src/lib/extraction/ruleExtractor'
import { computeRatios } from '../src/lib/engine/ratios'
import { evaluateAllTriggers } from '../src/lib/engine/triggerEngine'
import {
  toDealRow,
  toEvaluationRow,
  toSnapshotRow,
  toTriggerRuleRow,
} from '../src/lib/demo/seedDemo'
import type { Database } from '../src/lib/supabase/types'
import type { Deal, DealMarket } from '../src/lib/types/deal'
import type { PerformanceSnapshot, PerformanceSnapshotInput } from '../src/lib/types/performance'
import type { TriggerRule } from '../src/lib/types/trigger'

const DEMO_USER_ID = '1484fff4-ddba-4b1e-932c-5fb57f076ca9' // demo@absignal.io
const REAL_DIR = path.join(process.cwd(), 'public', 'demo', 'presales', 'real')

interface RealDeal {
  file: string
  dealId: string
  ruleBlock: string
  snapshotBlock: string
  market: DealMarket
  deal: Pick<
    Deal,
    | 'name'
    | 'issuer'
    | 'closingDate'
    | 'arDate'
    | 'totalIssuance'
    | 'assetCount'
    | 'collateralDescription'
    | 'ratingAgency'
    | 'rating'
  >
  snapshot: PerformanceSnapshotInput
}

const REAL_DEALS: RealDeal[] = [
  {
    file: 'centersquare-2025.md',
    dealId: 'c0000000-0000-4000-8000-000000000001',
    ruleBlock: 'a1000000',
    snapshotBlock: 'd1000000-0000-4000-8000-',
    market: 'NORTHERN_VIRGINIA',
    deal: {
      name: 'Centersquare Issuer LLC, Series 2025-1 / 2025-2',
      issuer: 'Phoenix Infrastructure',
      closingDate: '2025-03-15',
      arDate: '2030-03-15',
      totalIssuance: 985_000_000,
      assetCount: 26,
      collateralDescription:
        '26 multi-customer enterprise data centers (~150 MW) concentrated in the Northern Virginia / Mid-Atlantic region.',
      ratingAgency: 'KBRA',
      rating: 'A- (sf)',
    },
    snapshot: {
      periodDate: '2024-12-31',
      occupancyRate: 0.92,
      leasedCapacityMW: 138,
      totalCapacityMW: 150,
      contractedRevenue: 438_800_000,
      grossRevenue: 438_800_000,
      operatingExpenses: 229_900_000,
      netCashFlow: 208_900_000,
      scheduledDebtService: 99_000_000,
      seniorDebtService: 79_000_000,
      pueRatio: 1.45,
      powerCostPerKwh: 0.085,
      topTenantRevenuePct: 0.08,
      tenantCount: 1081,
      weightedAvgRemainingLeaseTerm: 3.9,
      outstandingBalance: 985_000_000,
      appraisedValue: 1_669_000_000,
      seniorInterestReserveBalance: 30_000_000,
      expenseReserveBalance: 12_000_000,
      requiredReserveBalance: 6_000_000,
      notes:
        'Closing snapshot from public KBRA/ASR disclosures (AANOI as of 2024-12-31). Real: AMRR, AANOI, capacity, tenants, top-tenant %, WART, Class A LTV. Modeled: debt service, occupancy, PUE, power cost, reserves.',
      source: 'MANUAL',
    },
  },
  {
    file: 'vantage-2025.md',
    dealId: 'c0000000-0000-4000-8000-000000000002',
    ruleBlock: 'a2000000',
    snapshotBlock: 'd2000000-0000-4000-8000-',
    market: 'SILICON_VALLEY',
    deal: {
      name: 'Vantage Data Centers Issuer LLC, Series 2025-1',
      issuer: 'Vantage Data Centers',
      closingDate: '2025-02-20',
      arDate: '2030-02-20',
      totalIssuance: 1_350_000_000,
      assetCount: 12,
      collateralDescription:
        'Wholesale / hyperscale data centers (~620 MW) anchored in Santa Clara (Silicon Valley).',
      ratingAgency: 'DBRS Morningstar',
      rating: 'A (low) (sf)',
    },
    snapshot: {
      periodDate: '2025-02-28',
      occupancyRate: 0.94,
      leasedCapacityMW: 583,
      totalCapacityMW: 620,
      contractedRevenue: 360_000_000,
      grossRevenue: 360_000_000,
      operatingExpenses: 117_000_000,
      netCashFlow: 243_000_000,
      scheduledDebtService: 150_000_000,
      seniorDebtService: 120_000_000,
      pueRatio: 1.3,
      powerCostPerKwh: 0.08,
      topTenantRevenuePct: 0.18,
      tenantCount: 24,
      weightedAvgRemainingLeaseTerm: 6.5,
      outstandingBalance: 1_350_000_000,
      appraisedValue: 2_045_000_000,
      seniorInterestReserveBalance: 40_000_000,
      expenseReserveBalance: 10_000_000,
      requiredReserveBalance: 8_000_000,
      notes:
        'Structural covenants real (DBRS/Scope): 1.35x cash trap, Class A DSCR >= 1.60x, Class A LTV <= 70%. Performance metrics modeled to that disclosed envelope (closing DSCR ~1.62x, LTV ~0.66).',
      source: 'MANUAL',
    },
  },
  {
    file: 'databank-2024-1.md',
    dealId: 'c0000000-0000-4000-8000-000000000003',
    ruleBlock: 'a3000000',
    snapshotBlock: 'd3000000-0000-4000-8000-',
    market: 'DALLAS',
    deal: {
      name: 'DataBank Issuer LLC, Series 2024-1',
      issuer: 'DataBank Holdings Ltd.',
      closingDate: '2024-09-15',
      arDate: '2029-09-15',
      totalIssuance: 725_000_000,
      assetCount: 35,
      collateralDescription:
        '35 data centers (~243 MW, ~1.5M sq ft) concentrated in Dallas/Houston with broad U.S. diversification.',
      ratingAgency: 'KBRA',
      rating: 'A (sf)',
    },
    snapshot: {
      periodDate: '2024-09-30',
      occupancyRate: 0.9,
      leasedCapacityMW: 219,
      totalCapacityMW: 243,
      contractedRevenue: 300_000_000,
      grossRevenue: 300_000_000,
      operatingExpenses: 130_000_000,
      netCashFlow: 170_000_000,
      scheduledDebtService: 82_000_000,
      seniorDebtService: 66_000_000,
      pueRatio: 1.5,
      powerCostPerKwh: 0.09,
      topTenantRevenuePct: 0.12,
      tenantCount: 400,
      weightedAvgRemainingLeaseTerm: 4.2,
      outstandingBalance: 725_000_000,
      appraisedValue: 1_150_000_000,
      seniorInterestReserveBalance: 12_000_000,
      expenseReserveBalance: 8_000_000,
      requiredReserveBalance: 6_000_000,
      notes:
        'Collateral (35 DCs, 243 MW, markets) real from KBRA release; senior interest reserve real ($12M). Financials modeled to standard DC ABS envelope.',
      source: 'MANUAL',
    },
  },
]

function loadDotEnv(filePath = '.env.local') {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    const value = rest.join('=').replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

/** Last calendar day of the month `monthsBack` before the given YYYY-MM-DD date. */
function monthEndBefore(periodDate: string, monthsBack: number): string {
  const base = new Date(`${periodDate}T00:00:00Z`)
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - monthsBack + 1, 0))
  return end.toISOString().slice(0, 10)
}

/**
 * Builds a short monthly history ending at the closing snapshot. Net cash flow ramps
 * gently up to the closing value so DSCR shows a mild healthy trend and lookback rules
 * have enough periods. Ratios are derived via the shared computeRatios.
 */
function buildHistory(
  base: PerformanceSnapshotInput,
  block: string,
  dealId: string,
  now: string,
): PerformanceSnapshot[] {
  const factors = [0.96, 0.98, 1.0]
  return factors.map((factor, index) => {
    const monthsBack = factors.length - 1 - index
    const input: PerformanceSnapshotInput = {
      ...base,
      periodDate: monthEndBefore(base.periodDate, monthsBack),
      netCashFlow: Math.round(base.netCashFlow * factor),
      grossRevenue: Math.round(base.grossRevenue * (0.99 + 0.01 * factor)),
      occupancyRate: Math.round(base.occupancyRate * (0.99 + 0.01 * factor) * 10_000) / 10_000,
    }
    return {
      ...input,
      id: `${block}${String(index + 1).padStart(12, '0')}`,
      dealId,
      ...computeRatios(input),
      source: input.source ?? 'MANUAL',
      createdAt: now,
    }
  })
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

  const now = new Date().toISOString()

  for (const config of REAL_DEALS) {
    const filePath = path.join(REAL_DIR, config.file)
    const text = fs.readFileSync(filePath, 'utf8')

    // Same call the /deals/new flow makes.
    const { dealMetadata, closingSnapshot, rules: candidates } = await extractDocumentWithOpenAI(
      text,
      { extractDealMetadata: true },
    )
    console.log(`\n${config.file} -> ${config.deal.name}`)
    console.log(`  extracted metadata: ${JSON.stringify(dealMetadata)}`)
    console.log(`  extracted snapshot keys: ${Object.keys(closingSnapshot).join(', ') || '(none)'}`)
    console.log(`  extracted ${candidates.length} candidate rules`)

    // Deal record — extracted metadata preferred, curated real values as fallback.
    const deal: Deal = {
      id: config.dealId,
      userId: DEMO_USER_ID,
      name: dealMetadata.name ?? config.deal.name,
      issuer: dealMetadata.issuer ?? config.deal.issuer,
      market: config.market, // force the app-supported market mapping
      closingDate: dealMetadata.closingDate ?? config.deal.closingDate,
      arDate: dealMetadata.arDate ?? config.deal.arDate,
      totalIssuance: dealMetadata.totalIssuanceMn
        ? Math.round(dealMetadata.totalIssuanceMn * 1_000_000)
        : config.deal.totalIssuance,
      assetCount: dealMetadata.assetCount ?? config.deal.assetCount,
      collateralDescription: dealMetadata.collateralDescription ?? config.deal.collateralDescription,
      ratingAgency: config.deal.ratingAgency,
      rating: config.deal.rating,
      ltv: computeRatios(config.snapshot).ltv,
      isDemo: false,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }
    const dealResult = await service.from('deals').upsert(toDealRow(deal), { onConflict: 'id' })
    if (dealResult.error) throw new Error(`${config.file}: deal upsert: ${dealResult.error.message}`)

    // Keep only numerically-evaluable covenants (a numeric threshold + numeric
    // comparison). Drops e.g. ARD/maturity rows with no measurable metric.
    const evaluable = candidates.filter(
      (candidate) => typeof candidate.threshold === 'number' && candidate.operator !== 'BINARY',
    )

    // Approved trigger rules (the genuinely-extracted covenant package).
    const rules: TriggerRule[] = evaluable.map((candidate, index) => ({
      id: `${config.ruleBlock}-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      dealId: config.dealId,
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
      extractionStatus: 'APPROVED',
      extractionConfidence: candidate.extractionConfidence,
      watchBuffer: candidate.watchBuffer,
      active: true,
      createdAt: now,
      updatedAt: now,
    }))

    // Clean re-insert so re-runs are idempotent across id/schema changes.
    const existing = await service.from('trigger_rules').select('id').eq('deal_id', config.dealId)
    const existingRuleIds = (existing.data ?? []).map((row) => row.id)
    if (existingRuleIds.length) {
      await service.from('trigger_evaluations').delete().in('rule_id', existingRuleIds)
    }
    await service.from('trigger_rules').delete().eq('deal_id', config.dealId)
    await service.from('performance_snapshots').delete().eq('deal_id', config.dealId)

    if (rules.length) {
      const rulesResult = await service.from('trigger_rules').insert(rules.map(toTriggerRuleRow))
      if (rulesResult.error) throw new Error(`${config.file}: rules insert: ${rulesResult.error.message}`)
    }

    // Closing snapshot — curated input merged with any extracted numeric values.
    const base: PerformanceSnapshotInput = { ...config.snapshot }
    for (const [key, value] of Object.entries(closingSnapshot)) {
      if (typeof value === 'number' && key !== 'periodDate') {
        ;(base as Record<string, unknown>)[key] = value
      }
    }

    // A 3-month history ending at the closing snapshot lets 3-month-average rules
    // evaluate and the trend charts render.
    const history = buildHistory(base, config.snapshotBlock, config.dealId, now)
    const snapResult = await service
      .from('performance_snapshots')
      .insert(history.map(toSnapshotRow))
    if (snapResult.error) throw new Error(`${config.file}: snapshot insert: ${snapResult.error.message}`)

    // Evaluate every snapshot against its trailing window (matches the app).
    const evaluations = history.flatMap((snap) =>
      evaluateAllTriggers(
        rules,
        history.filter((item) => item.periodDate <= snap.periodDate),
      ),
    )
    if (evaluations.length) {
      const evalResult = await service
        .from('trigger_evaluations')
        .upsert(evaluations.map(toEvaluationRow), { onConflict: 'rule_id,snapshot_id' })
      if (evalResult.error) throw new Error(`${config.file}: evals upsert: ${evalResult.error.message}`)
    }

    const latest = history[history.length - 1]
    const latestStatuses = evaluateAllTriggers(rules, history).reduce<Record<string, number>>(
      (acc, evaluation) => ({ ...acc, [evaluation.status]: (acc[evaluation.status] ?? 0) + 1 }),
      {},
    )
    console.log(
      `  persisted: deal, ${rules.length} approved rules, ${history.length} snapshots ` +
        `(latest DSCR ${latest.dscr}x, LTV ${latest.ltv}), ${evaluations.length} evals ${JSON.stringify(latestStatuses)}`,
    )
  }

  console.log('\nReal-deal ingest complete.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
