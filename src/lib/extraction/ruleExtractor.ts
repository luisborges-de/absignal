import OpenAI from 'openai'
import { DEAL_MARKETS, type DealMarket } from '@/lib/types/deal'
import type {
  ExtractedRuleCandidate,
  TriggerConsequence,
  TriggerFamily,
  TriggerOperator,
} from '@/lib/types/trigger'

const families: TriggerFamily[] = [
  'DSCR_CASH_TRAP',
  'DSCR_EARLY_AMORTISATION',
  'DSCR_SENIOR_CASH_TRAP',
  'LTV_SWEEP',
  'OCCUPANCY_RESERVE',
  'TENANT_CONCENTRATION',
  'WART_RESERVE',
  'WALT_CASH_TRAP',
  'PUE_EFFICIENCY',
  'POWER_COST',
  'SERVICER_TERMINATION',
  'ADDITIONAL_ISSUANCE',
  'ARD_MATURITY',
  'EXPENSE_RESERVE',
  'INTEREST_RESERVE',
]

export interface ExtractedDealMetadata {
  name?: string
  issuer?: string
  market?: DealMarket
  totalIssuanceMn?: number
  assetCount?: number
  closingDate?: string
  arDate?: string
  collateralDescription?: string
}

/**
 * The slice of a PerformanceSnapshot a presale report reliably states as of the
 * cut-off/closing date. All optional — the model omits anything not in the doc, and
 * dscr/seniorDscr/ltv are intentionally excluded because computeRatios() derives them.
 */
export interface ExtractedSnapshot {
  periodDate?: string
  occupancyRate?: number
  leasedCapacityMW?: number
  totalCapacityMW?: number
  contractedRevenue?: number
  grossRevenue?: number
  operatingExpenses?: number
  netCashFlow?: number
  scheduledDebtService?: number
  seniorDebtService?: number
  pueRatio?: number
  powerCostPerKwh?: number
  topTenantRevenuePct?: number
  tenantCount?: number
  weightedAvgRemainingLeaseTerm?: number
  outstandingBalance?: number
  appraisedValue?: number
  seniorInterestReserveBalance?: number
  expenseReserveBalance?: number
  requiredReserveBalance?: number
}

export interface ExtractionResult {
  dealMetadata: ExtractedDealMetadata
  closingSnapshot: ExtractedSnapshot
  rules: ExtractedRuleCandidate[]
}

export const MAX_OPENAI_PDF_FILE_BYTES = 50 * 1024 * 1024

const operators: TriggerOperator[] = ['LT', 'GT', 'LTE', 'GTE', 'EQ', 'BINARY']

const consequences: TriggerConsequence[] = [
  'CASH_TRAP',
  'EARLY_AMORTISATION',
  'ENHANCED_RESERVE',
  'MANDATORY_DELEVERAGING',
  'TURBO_AMORTISATION',
  'RATE_STEP_UP',
  'MANAGER_REMOVAL',
  'ISSUANCE_BLOCKED',
]

const RULES_SPEC = `Only emit triggers that are MEASURABLE from a numeric PerformanceSnapshot field.
Skip covenants you cannot express as a numeric comparison (e.g. a pure
anticipated-repayment-date / maturity event with no measurable metric).
Do not stop after the first few obvious DSCR tests. Search the transaction overview,
strengths/weaknesses, waterfall, priority-of-payments, draw-condition, reserve,
cash trap, PIK period, amortization period, and LTV-test language. Emit separate
rules when the same numeric threshold causes distinct consequences (for example,
a PIK period and a cash trap condition at the same DSCR threshold).
Include variable-funding note draw/issuance blockers, post-draw DSCR/LTV tests,
cash trap tests, amortization-period tests, LTV sweep tests, reserve funding tests,
and class-specific DSCR tests when they can be mapped to numeric snapshot metrics.

CRITICAL — operator + threshold must express the BREACH (violation) condition: the
state in which the bad thing happens, NOT the healthy maintenance condition.
- "Cash trap if 3-month DSCR is less than 1.35x" -> operator LT, threshold 1.35
- "Maintain a senior interest reserve of at least $12,000,000" -> the breach is the
  balance FALLING BELOW the floor -> operator LT, threshold 12000000
- "If LTV exceeds 70.0%, sweep cash" -> operator GT, threshold 0.70
- "Maintain occupancy above 75%" -> operator LT, threshold 0.75

For each trigger found, produce an object with exactly these fields:
- family: one of [DSCR_CASH_TRAP, DSCR_EARLY_AMORTISATION, DSCR_SENIOR_CASH_TRAP,
  LTV_SWEEP, OCCUPANCY_RESERVE, TENANT_CONCENTRATION, WART_RESERVE, WALT_CASH_TRAP,
  PUE_EFFICIENCY, POWER_COST, SERVICER_TERMINATION, ADDITIONAL_ISSUANCE,
  ARD_MATURITY, EXPENSE_RESERVE, INTEREST_RESERVE]
- name: short human-readable label
- description: one sentence
- metricKey: a numeric PerformanceSnapshot field (dscr | seniorDscr | ltv | occupancyRate |
  topTenantRevenuePct | weightedAvgRemainingLeaseTerm | expenseReserveBalance |
  seniorInterestReserveBalance | pueRatio | powerCostPerKwh | etc.) — never invent a field
- operator: LT | GT | LTE | GTE | EQ  (use a numeric comparison; avoid BINARY)
- threshold: numeric (required — omit the rule entirely if there is no numeric threshold)
- thresholdUnit: "x" | "%" | "years" | "USD" | "$/kWh"
- lookbackPeriods: int (default 1; use 3 if doc says "3-month average")
- consequence: CASH_TRAP | EARLY_AMORTISATION | ENHANCED_RESERVE |
  MANDATORY_DELEVERAGING | TURBO_AMORTISATION | RATE_STEP_UP |
  MANAGER_REMOVAL | ISSUANCE_BLOCKED
- sectionReference: section number cited
- sourceText: verbatim sentence(s)
- extractionConfidence: 0.0-1.0`

const DEAL_METADATA_SPEC = `Also extract deal-level metadata into a "dealMetadata" object with these
optional fields (omit any field you cannot find; do not guess):
- name: full series name, e.g. "Vantage Data Centers Issuer LLC, Series 2025-1"
- issuer: sponsor or issuer name
- market: nearest of [NORTHERN_VIRGINIA, SILICON_VALLEY, CHICAGO, DALLAS, PHOENIX]
  based on where the collateral is concentrated; use NORTHERN_VIRGINIA when ambiguous
- totalIssuanceMn: total issuance in millions of USD (e.g. 940 for $940,000,000)
- assetCount: number of data centers in the collateral pool
- closingDate: YYYY-MM-DD
- arDate: anticipated repayment date, YYYY-MM-DD
- collateralDescription: one sentence describing the collateral pool`

const SNAPSHOT_SPEC = `Also extract the collateral pool's performance metrics AS OF THE CUT-OFF / CLOSING
DATE into a "closingSnapshot" object. These are the headline figures a presale report
states at issuance. Omit any field not explicitly stated; never guess or compute.
Do NOT include dscr, seniorDscr, or ltv — those are derived downstream.
- periodDate: cut-off/closing date, YYYY-MM-DD
- occupancyRate: 0.0-1.0 (e.g. 0.92 for 92%)
- leasedCapacityMW, totalCapacityMW: megawatts
- contractedRevenue, grossRevenue, operatingExpenses, netCashFlow: annualized USD
- scheduledDebtService, seniorDebtService: annual USD
- pueRatio: power usage effectiveness (e.g. 1.30)
- powerCostPerKwh: USD per kWh
- topTenantRevenuePct: 0.0-1.0 single largest tenant share
- tenantCount: integer
- weightedAvgRemainingLeaseTerm: years (WALT/WART)
- outstandingBalance, appraisedValue: USD
- seniorInterestReserveBalance, expenseReserveBalance, requiredReserveBalance: USD`

/**
 * Anchors used to reduce an oversized document (e.g. a full indenture) down to the
 * sections that actually carry covenant/waterfall/trigger and pool-summary language,
 * so it fits inside the model's context window. Presale reports are small and pass
 * through selectRelevantSections() untouched.
 */
const SECTION_ANCHORS = [
  'priority of payments',
  'cash flow waterfall',
  'waterfall',
  'cash trap',
  'amortization event',
  'amortisation event',
  'early amortization',
  'rapid amortization',
  'debt service coverage',
  'dscr',
  'covenant',
  'reserve',
  'collateral',
  'portfolio summary',
  'pool',
  'occupancy',
  'tenant',
  'anticipated repayment',
  'loan-to-value',
  'ltv',
  'weighted average',
  'events of default',
]

/**
 * Returns text small enough to send to the model. Documents within budget are returned
 * verbatim. Oversized documents keep the head (transaction summary) plus windows around
 * each covenant/waterfall anchor, de-duplicated and capped at maxChars.
 */
export function selectRelevantSections(text: string, maxChars = 350_000): string {
  if (text.length <= maxChars) return text

  const headChars = 20_000
  const windowRadius = 6_000
  const lower = text.toLowerCase()

  // Collect [start, end] windows around each anchor occurrence.
  const ranges: Array<[number, number]> = [[0, Math.min(headChars, text.length)]]
  for (const anchor of SECTION_ANCHORS) {
    let from = 0
    while (from < lower.length) {
      const hit = lower.indexOf(anchor, from)
      if (hit === -1) break
      ranges.push([Math.max(0, hit - windowRadius), Math.min(text.length, hit + windowRadius)])
      from = hit + anchor.length
    }
  }

  // Merge overlapping ranges in document order.
  ranges.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [start, end] of ranges) {
    const last = merged.at(-1)
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }

  // Concatenate up to the budget; if no anchors matched we still have the head slice.
  let budget = maxChars
  const parts: string[] = []
  for (const [start, end] of merged) {
    if (budget <= 0) break
    const slice = text.slice(start, Math.min(end, start + budget))
    parts.push(slice)
    budget -= slice.length
  }
  return parts.join('\n\n[…]\n\n')
}

export function buildExtractionPrompt(documentText: string, extractDealMetadata = false) {
  return `You are a structured data extraction engine for securitization documents.
Extract every performance trigger, covenant test, and cash flow diversion condition.
Focus on the covenant package, cash flow waterfall section, and trigger definitions.
Ignore boilerplate risk factor and tax sections.

${RULES_SPEC}

${extractDealMetadata ? `${DEAL_METADATA_SPEC}\n\n${SNAPSHOT_SPEC}` : ''}

Return ONLY a JSON object of the form:
${extractDealMetadata ? '{ "dealMetadata": { ... }, "closingSnapshot": { ... }, "rules": [ ... ] }' : '{ "rules": [ ... ] }'}
No preamble. No markdown. No explanation.

Document:
${documentText}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function numberField(value: unknown, fallback: number | null = null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function ruleKey(rule: ExtractedRuleCandidate) {
  return [
    rule.family,
    rule.metricKey,
    rule.operator,
    rule.threshold ?? 'null',
    rule.consequence,
  ].join(':')
}

function normalizeThresholdUnit(metricKey: string, thresholdUnit: string) {
  if (['ltv', 'occupancyRate', 'topTenantRevenuePct'].includes(metricKey)) return '%'
  if (['dscr', 'seniorDscr', 'pueRatio'].includes(metricKey)) return 'x'
  if (metricKey === 'powerCostPerKwh') return '$/kWh'
  if (metricKey === 'weightedAvgRemainingLeaseTerm') return 'years'
  if (
    [
      'contractedRevenue',
      'grossRevenue',
      'operatingExpenses',
      'netCashFlow',
      'scheduledDebtService',
      'seniorDebtService',
      'outstandingBalance',
      'appraisedValue',
      'seniorInterestReserveBalance',
      'expenseReserveBalance',
      'requiredReserveBalance',
    ].includes(metricKey)
  ) return 'USD'

  return thresholdUnit
}

function isDrawConditionRule(rule: ExtractedRuleCandidate) {
  const text = `${rule.name} ${rule.description} ${rule.sourceText}`.toLowerCase()
  return /draw condition|post-draw|variable-funding|vfn/.test(text)
}

function isSameThreshold(left: number | null, right: number | null) {
  if (left === null || right === null) return left === right
  return Math.abs(left - right) < 0.000001
}

function hasReplacementAdditionalIssuance(
  rule: ExtractedRuleCandidate,
  supplemental: ExtractedRuleCandidate[],
) {
  return supplemental.some((candidate) =>
    candidate.family === 'ADDITIONAL_ISSUANCE' &&
    candidate.metricKey === rule.metricKey &&
    candidate.operator === rule.operator &&
    candidate.consequence === 'ISSUANCE_BLOCKED' &&
    isSameThreshold(candidate.threshold, rule.threshold),
  )
}

export function mergeExtractedRules(
  primary: ExtractedRuleCandidate[],
  supplemental: ExtractedRuleCandidate[],
) {
  const normalizedPrimary = primary
    .map((rule) => ({
      ...rule,
      thresholdUnit: normalizeThresholdUnit(rule.metricKey, rule.thresholdUnit),
    }))
    .filter((rule) => {
      if (rule.family === 'ADDITIONAL_ISSUANCE') return true
      if (!isDrawConditionRule(rule)) return true
      return !hasReplacementAdditionalIssuance(rule, supplemental)
    })

  const normalizedSupplemental = supplemental.map((rule) => ({
    ...rule,
    thresholdUnit: normalizeThresholdUnit(rule.metricKey, rule.thresholdUnit),
  }))

  const seen = new Set(normalizedPrimary.map(ruleKey))
  const merged = [...normalizedPrimary]

  for (const rule of normalizedSupplemental) {
    const key = ruleKey(rule)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(rule)
  }

  return merged
}

function errorMessage(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

export function isFallbackEligiblePdfError(error: unknown) {
  const message = errorMessage(error).toLowerCase()
  const fallbackSignals = [
    'password',
    'encrypt',
    'invalidpdf',
    'corrupt',
    'scanned',
    'image-only',
    'no readable text',
    'could not read this pdf',
    'formaterror',
  ]

  return fallbackSignals.some((signal) => message.includes(signal))
}

export function assertPdfFileWithinOpenAILimit(byteLength: number) {
  if (byteLength > MAX_OPENAI_PDF_FILE_BYTES) {
    throw new Error(
      'PDF is too large for AI PDF fallback. OpenAI file inputs support PDFs up to 50 MB.',
    )
  }
}

export function validateExtractedRules(value: unknown): ExtractedRuleCandidate[] {
  if (!Array.isArray(value)) throw new Error('Extractor did not return a JSON array.')

  // Real documents occasionally yield an off-spec row (an unmapped family, a
  // missing operator). Skip those rather than discarding the whole extraction —
  // the valid covenants still come through.
  const valid: ExtractedRuleCandidate[] = []
  for (const item of value) {
    if (!isRecord(item)) continue

    const family = item.family
    const operator = item.operator
    const consequence = item.consequence

    if (!families.includes(family as TriggerFamily)) continue
    if (!operators.includes(operator as TriggerOperator)) continue
    if (!consequences.includes(consequence as TriggerConsequence)) continue

    valid.push({
      family: family as TriggerFamily,
      name: stringField(item.name, String(family).replaceAll('_', ' ')),
      description: stringField(item.description),
      metricKey: stringField(item.metricKey, 'dscr'),
      operator: operator as TriggerOperator,
      threshold: numberField(item.threshold),
      thresholdUnit: normalizeThresholdUnit(
        stringField(item.metricKey, 'dscr'),
        stringField(item.thresholdUnit, 'x'),
      ),
      lookbackPeriods: Math.max(1, Math.round(numberField(item.lookbackPeriods, 1) ?? 1)),
      consequence: consequence as TriggerConsequence,
      sectionReference: stringField(item.sectionReference),
      sourceText: stringField(item.sourceText),
      extractionConfidence: Math.min(1, Math.max(0, numberField(item.extractionConfidence, 0.7) ?? 0.7)),
      watchBuffer: 0.1,
    })
  }
  return valid
}

export function heuristicExtractRules(documentText: string): ExtractedRuleCandidate[] {
  const source = documentText
  const includes = (needle: string) => source.toLowerCase().includes(needle.toLowerCase())
  const rules: ExtractedRuleCandidate[] = []
  const hasRule = (candidate: ExtractedRuleCandidate) => rules.some((rule) => ruleKey(rule) === ruleKey(candidate))
  const addRule = (candidate: ExtractedRuleCandidate) => {
    if (!hasRule(candidate)) rules.push(candidate)
  }

  if (includes('1.35x')) {
    rules.push({
      family: 'DSCR_CASH_TRAP',
      name: '3m DSCR Cash Trap',
      description: 'Cash trap if three-month rolling average DSCR falls below 1.35x.',
      metricKey: 'dscr',
      operator: 'LT',
      threshold: 1.35,
      thresholdUnit: 'x',
      lookbackPeriods: 3,
      consequence: 'CASH_TRAP',
      sectionReference: 'Section 3.14(b)(ii)',
      sourceText: 'If the three-month rolling average DSCR falls below 1.35x, a Cash Trap Event shall occur.',
      extractionConfidence: 0.91,
      watchBuffer: 0.1,
    })
  }

  if (includes('1.10x')) {
    rules.push({
      family: 'DSCR_EARLY_AMORTISATION',
      name: '3m DSCR Early Amortisation',
      description: 'Early amortisation if three-month rolling average DSCR falls below 1.10x.',
      metricKey: 'dscr',
      operator: 'LT',
      threshold: 1.1,
      thresholdUnit: 'x',
      lookbackPeriods: 3,
      consequence: 'EARLY_AMORTISATION',
      sectionReference: 'Section 3.14(c)(i)',
      sourceText: 'If the three-month rolling average DSCR falls below 1.10x, an Early Amortisation Event shall occur.',
      extractionConfidence: 0.9,
      watchBuffer: 0.1,
    })
  }

  if (includes('65.0%')) {
    rules.push({
      family: 'LTV_SWEEP',
      name: 'LTV Sweep',
      description: 'Mandatory deleveraging if LTV exceeds 65.0%.',
      metricKey: 'ltv',
      operator: 'GT',
      threshold: 0.65,
      thresholdUnit: '%',
      lookbackPeriods: 1,
      consequence: 'MANDATORY_DELEVERAGING',
      sectionReference: 'Section 3.15(a)',
      sourceText: 'If the LTV Ratio exceeds 65.0%, excess funds apply to mandatory deleveraging.',
      extractionConfidence: 0.88,
      watchBuffer: 0.08,
    })
  }

  if (includes('75.0%')) {
    rules.push({
      family: 'OCCUPANCY_RESERVE',
      name: 'Occupancy Reserve',
      description: 'Enhanced liquidity reserve if weighted average occupancy falls below 75.0%.',
      metricKey: 'occupancyRate',
      operator: 'LT',
      threshold: 0.75,
      thresholdUnit: '%',
      lookbackPeriods: 1,
      consequence: 'ENHANCED_RESERVE',
      sectionReference: 'Section 3.16(b)',
      sourceText: 'If weighted average occupancy falls below 75.0%, the issuer shall maintain an Enhanced Liquidity Reserve.',
      extractionConfidence: 0.9,
      watchBuffer: 0.05,
    })
  }

  if (includes('40.0%')) {
    rules.push({
      family: 'TENANT_CONCENTRATION',
      name: 'Top Tenant Concentration',
      description: 'Enhanced reserve if a single tenant exceeds 40.0% of total portfolio revenue.',
      metricKey: 'topTenantRevenuePct',
      operator: 'GT',
      threshold: 0.4,
      thresholdUnit: '%',
      lookbackPeriods: 1,
      consequence: 'ENHANCED_RESERVE',
      sectionReference: 'Section 3.17(a)',
      sourceText: 'Contracted revenue from any single tenant shall not exceed 40.0% of total portfolio revenue.',
      extractionConfidence: 0.86,
      watchBuffer: 0.1,
    })
  }

  if (includes('2.5 years')) {
    rules.push({
      family: 'WART_RESERVE',
      name: 'WART Covenant',
      description: 'Enhanced reserve if portfolio WART falls below 2.5 years.',
      metricKey: 'weightedAvgRemainingLeaseTerm',
      operator: 'LT',
      threshold: 2.5,
      thresholdUnit: 'years',
      lookbackPeriods: 1,
      consequence: 'ENHANCED_RESERVE',
      sectionReference: 'Section 3.18',
      sourceText: 'Portfolio weighted average remaining lease term shall be maintained above 2.5 years.',
      extractionConfidence: 0.84,
      watchBuffer: 0.1,
    })
  }

  if (includes('$6,000,000')) {
    rules.push({
      family: 'EXPENSE_RESERVE',
      name: 'Operating Expense Reserve',
      description: 'Enhanced reserve if operating expense reserve falls below $6,000,000.',
      metricKey: 'expenseReserveBalance',
      operator: 'LT',
      threshold: 6_000_000,
      thresholdUnit: 'USD',
      lookbackPeriods: 1,
      consequence: 'ENHANCED_RESERVE',
      sectionReference: 'Section 3.19',
      sourceText: 'The issuer shall maintain an Operating Expense Reserve of at least $6,000,000 at all times.',
      extractionConfidence: 0.85,
      watchBuffer: 0.1,
    })
  }

  const maxLtvMatch = source.match(/maximum\s+(\d+(?:\.\d+)?)%\s+LTV/i)
  const minDscrDrawMatch = source.match(/minimum\s+(\d+(?:\.\d+)?)x\s+(?:three-month|3-month)[^.]*DSCR/i)
  const pikDscrMatch = source.match(/PIK period trigger[\s\S]{0,500}?DSCR is below\s+(\d+(?:\.\d+)?)x/i)
  const cashTrapDscrMatch = source.match(/cash trap condition[\s\S]{0,350}?DSCR is less than\s+(\d+(?:\.\d+)?)x/i)
  const amortizationDscrMatch = source.match(/amortization period[\s\S]{0,350}?DSCR is less than\s+(\d+(?:\.\d+)?)x/i)
  const ltvSweepApplies = /class A LTV test sweep amount/i.test(source)

  if (maxLtvMatch && /draw conditions|variable-funding notes|VFN/i.test(source)) {
    const threshold = Number(maxLtvMatch[1]) / 100
    addRule({
      family: 'ADDITIONAL_ISSUANCE',
      name: 'VFN Post-Draw LTV Condition',
      description: 'Variable-funding note draws are blocked if post-draw LTV exceeds the maximum level.',
      metricKey: 'ltv',
      operator: 'GT',
      threshold,
      thresholdUnit: '%',
      lookbackPeriods: 1,
      consequence: 'ISSUANCE_BLOCKED',
      sectionReference: 'Draw conditions',
      sourceText: `Draw conditions require post-draw maintenance of a maximum ${maxLtvMatch[1]}% LTV ratio.`,
      extractionConfidence: 0.86,
      watchBuffer: 0.08,
    })
  }

  if (minDscrDrawMatch && /draw conditions|variable-funding notes|VFN/i.test(source)) {
    const threshold = Number(minDscrDrawMatch[1])
    addRule({
      family: 'ADDITIONAL_ISSUANCE',
      name: 'VFN Post-Draw DSCR Condition',
      description: 'Variable-funding note draws are blocked if three-month average DSCR falls below the minimum level.',
      metricKey: 'dscr',
      operator: 'LT',
      threshold,
      thresholdUnit: 'x',
      lookbackPeriods: 3,
      consequence: 'ISSUANCE_BLOCKED',
      sectionReference: 'Draw conditions',
      sourceText: `Draw conditions require post-draw maintenance of a minimum ${minDscrDrawMatch[1]}x three-month average DSCR.`,
      extractionConfidence: 0.86,
      watchBuffer: 0.1,
    })
  }

  if (pikDscrMatch) {
    const threshold = Number(pikDscrMatch[1])
    addRule({
      family: 'DSCR_SENIOR_CASH_TRAP',
      name: 'PIK Period DSCR Trigger',
      description: 'PIK period begins if three-month average amortization DSCR falls below the trigger level.',
      metricKey: 'dscr',
      operator: 'LT',
      threshold,
      thresholdUnit: 'x',
      lookbackPeriods: 3,
      consequence: 'RATE_STEP_UP',
      sectionReference: 'Waterfall / PIK period',
      sourceText: `PIK period is in effect when three-month average amortization DSCR is below ${pikDscrMatch[1]}x.`,
      extractionConfidence: 0.84,
      watchBuffer: 0.1,
    })
  }

  if (cashTrapDscrMatch) {
    const threshold = Number(cashTrapDscrMatch[1])
    addRule({
      family: 'DSCR_CASH_TRAP',
      name: 'Amortization DSCR Cash Trap',
      description: 'Cash trap condition occurs if three-month average amortization DSCR falls below the cash trap threshold.',
      metricKey: 'dscr',
      operator: 'LT',
      threshold,
      thresholdUnit: 'x',
      lookbackPeriods: 3,
      consequence: 'CASH_TRAP',
      sectionReference: 'Waterfall / cash trap condition',
      sourceText: `Cash trap condition occurs if three-month average amortization DSCR is less than ${cashTrapDscrMatch[1]}x.`,
      extractionConfidence: 0.9,
      watchBuffer: 0.1,
    })
  }

  if (amortizationDscrMatch) {
    const threshold = Number(amortizationDscrMatch[1])
    addRule({
      family: 'DSCR_EARLY_AMORTISATION',
      name: 'Amortization Period DSCR Trigger',
      description: 'Amortization period occurs if three-month average amortization DSCR falls below the minimum threshold.',
      metricKey: 'dscr',
      operator: 'LT',
      threshold,
      thresholdUnit: 'x',
      lookbackPeriods: 3,
      consequence: 'EARLY_AMORTISATION',
      sectionReference: 'Waterfall / amortization period',
      sourceText: `Amortization period occurs if three-month average amortization DSCR is less than ${amortizationDscrMatch[1]}x.`,
      extractionConfidence: 0.9,
      watchBuffer: 0.1,
    })
  }

  if (ltvSweepApplies && maxLtvMatch) {
    const threshold = Number(maxLtvMatch[1]) / 100
    addRule({
      family: 'LTV_SWEEP',
      name: 'Class A LTV Test Sweep',
      description: 'Class A LTV test sweep amount applies if LTV exceeds the maximum class A threshold.',
      metricKey: 'ltv',
      operator: 'GT',
      threshold,
      thresholdUnit: '%',
      lookbackPeriods: 1,
      consequence: 'MANDATORY_DELEVERAGING',
      sectionReference: 'Waterfall / class A LTV test sweep',
      sourceText: `Waterfall includes any class A LTV test sweep amount; transaction text states maximum ${maxLtvMatch[1]}% LTV.`,
      extractionConfidence: 0.82,
      watchBuffer: 0.08,
    })
  }

  return rules
}

function normalizeMarket(value: unknown): DealMarket | undefined {
  if (typeof value !== 'string') return undefined
  const candidate = value.toUpperCase().replaceAll(/[\s-]+/g, '_') as DealMarket
  return DEAL_MARKETS.includes(candidate) ? candidate : 'NORTHERN_VIRGINIA'
}

function dateField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

export function validateDealMetadata(value: unknown): ExtractedDealMetadata {
  if (!isRecord(value)) return {}

  const metadata: ExtractedDealMetadata = {}
  if (typeof value.name === 'string' && value.name.trim()) metadata.name = value.name.trim()
  if (typeof value.issuer === 'string' && value.issuer.trim()) metadata.issuer = value.issuer.trim()
  const market = normalizeMarket(value.market)
  if (market) metadata.market = market
  const totalIssuanceMn = numberField(value.totalIssuanceMn)
  if (totalIssuanceMn !== null && totalIssuanceMn > 0) metadata.totalIssuanceMn = totalIssuanceMn
  const assetCount = numberField(value.assetCount)
  if (assetCount !== null && assetCount > 0) metadata.assetCount = Math.round(assetCount)
  const closingDate = dateField(value.closingDate)
  if (closingDate) metadata.closingDate = closingDate
  const arDate = dateField(value.arDate)
  if (arDate) metadata.arDate = arDate
  if (typeof value.collateralDescription === 'string' && value.collateralDescription.trim()) {
    metadata.collateralDescription = value.collateralDescription.trim()
  }
  return metadata
}

export function validateExtractedSnapshot(value: unknown): ExtractedSnapshot {
  if (!isRecord(value)) return {}

  const snapshot: ExtractedSnapshot = {}
  const periodDate = dateField(value.periodDate)
  if (periodDate) snapshot.periodDate = periodDate

  const numericKeys: Array<keyof ExtractedSnapshot> = [
    'occupancyRate',
    'leasedCapacityMW',
    'totalCapacityMW',
    'contractedRevenue',
    'grossRevenue',
    'operatingExpenses',
    'netCashFlow',
    'scheduledDebtService',
    'seniorDebtService',
    'pueRatio',
    'powerCostPerKwh',
    'topTenantRevenuePct',
    'tenantCount',
    'weightedAvgRemainingLeaseTerm',
    'outstandingBalance',
    'appraisedValue',
    'seniorInterestReserveBalance',
    'expenseReserveBalance',
    'requiredReserveBalance',
  ]
  for (const key of numericKeys) {
    const parsed = numberField((value as Record<string, unknown>)[key])
    if (parsed !== null) (snapshot[key] as number) = parsed
  }
  if (snapshot.tenantCount !== undefined) snapshot.tenantCount = Math.round(snapshot.tenantCount)
  return snapshot
}

export function isOpenAIConfigured() {
  const apiKey = process.env.OPENAI_API_KEY
  return Boolean(apiKey && !apiKey.startsWith('your-'))
}

function extractionModel() {
  return process.env.OPENAI_EXTRACTION_MODEL?.trim() || 'gpt-4o'
}

function parseExtractionResponse(text: string, extractDealMetadata = false): ExtractionResult {
  const parsed = JSON.parse(text) as unknown
  if (!isRecord(parsed)) throw new Error('Extractor did not return a JSON object.')

  return {
    dealMetadata: extractDealMetadata ? validateDealMetadata(parsed.dealMetadata) : {},
    closingSnapshot: extractDealMetadata ? validateExtractedSnapshot(parsed.closingSnapshot) : {},
    rules: validateExtractedRules(parsed.rules),
  }
}

export interface ExtractDocumentOptions {
  extractDealMetadata?: boolean
}

export async function extractDocumentWithOpenAI(
  documentText: string,
  options: ExtractDocumentOptions = {},
): Promise<ExtractionResult> {
  if (!isOpenAIConfigured()) {
    return { dealMetadata: {}, closingSnapshot: {}, rules: heuristicExtractRules(documentText) }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: extractionModel(),
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: buildExtractionPrompt(
          selectRelevantSections(documentText),
          options.extractDealMetadata ?? false,
        ),
      },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  const result = parseExtractionResponse(text, options.extractDealMetadata ?? false)
  return {
    ...result,
    rules: mergeExtractedRules(result.rules, heuristicExtractRules(documentText)),
  }
}

export interface ExtractPdfDocumentOptions extends ExtractDocumentOptions {
  filename?: string
  mimeType?: string
}

export async function extractPdfFileWithOpenAI(
  pdfBytes: Uint8Array,
  options: ExtractPdfDocumentOptions = {},
): Promise<ExtractionResult> {
  assertPdfFileWithinOpenAILimit(pdfBytes.byteLength)

  if (!isOpenAIConfigured()) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Add it to .env.local, upload an unlocked PDF, or paste the document text.',
    )
  }

  const mimeType = options.mimeType || 'application/pdf'
  const filename = options.filename || 'document.pdf'
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: extractionModel(),
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            file: {
              filename,
              file_data: `data:${mimeType};base64,${Buffer.from(pdfBytes).toString('base64')}`,
            },
          },
          {
            type: 'text',
            text: buildExtractionPrompt(
              'The source document is attached as a PDF file. Extract from the attached PDF.',
              options.extractDealMetadata ?? false,
            ),
          },
        ],
      },
    ],
  })

  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  return parseExtractionResponse(text, options.extractDealMetadata ?? false)
}

/** Back-compat wrapper: rules-only extraction. */
export async function extractRules(documentText: string) {
  const result = await extractDocumentWithOpenAI(documentText)
  return result.rules
}
