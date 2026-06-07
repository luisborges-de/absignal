import Anthropic from '@anthropic-ai/sdk'
import type {
  ExtractedRuleCandidate,
  TriggerConsequence,
  TriggerFamily,
  TriggerOperator,
} from '@/lib/types/trigger'

const families: TriggerFamily[] = [
  'DSCR_CASH_TRAP',
  'DSCR_EARLY_AMORTISATION',
  'LTV_SWEEP',
  'OCCUPANCY_RESERVE',
  'TENANT_CONCENTRATION',
  'WART_RESERVE',
  'SERVICER_TERMINATION',
  'ADDITIONAL_ISSUANCE',
  'ARD_MATURITY',
  'EXPENSE_RESERVE',
]

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

export function buildExtractionPrompt(documentText: string) {
  return `You are a structured data extraction engine for securitization documents.
Extract every performance trigger, covenant test, and cash flow diversion condition.

For each trigger found, return a JSON object with exactly these fields:
- family: one of [DSCR_CASH_TRAP, DSCR_EARLY_AMORTISATION, LTV_SWEEP,
  OCCUPANCY_RESERVE, TENANT_CONCENTRATION, WART_RESERVE, SERVICER_TERMINATION,
  ADDITIONAL_ISSUANCE, ARD_MATURITY, EXPENSE_RESERVE]
- name: short human-readable label
- description: one sentence
- metricKey: PerformanceSnapshot field (dscr | ltv | occupancyRate |
  topTenantRevenuePct | weightedAvgRemainingLeaseTerm | expenseReserveBalance | etc.)
- operator: LT | GT | LTE | GTE | EQ | BINARY
- threshold: numeric or null
- thresholdUnit: "x" | "%" | "years" | "USD"
- lookbackPeriods: int (default 1; use 3 if doc says "3-month average")
- consequence: CASH_TRAP | EARLY_AMORTISATION | ENHANCED_RESERVE |
  MANDATORY_DELEVERAGING | TURBO_AMORTISATION | RATE_STEP_UP |
  MANAGER_REMOVAL | ISSUANCE_BLOCKED
- sectionReference: section number cited
- sourceText: verbatim sentence(s)
- extractionConfidence: 0.0-1.0

Return ONLY a JSON array. No preamble. No markdown. No explanation.

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

export function validateExtractedRules(value: unknown): ExtractedRuleCandidate[] {
  if (!Array.isArray(value)) throw new Error('Extractor did not return a JSON array.')

  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Rule ${index + 1} is not an object.`)

    const family = item.family
    const operator = item.operator
    const consequence = item.consequence

    if (!families.includes(family as TriggerFamily)) throw new Error(`Rule ${index + 1} has invalid family.`)
    if (!operators.includes(operator as TriggerOperator)) {
      throw new Error(`Rule ${index + 1} has invalid operator.`)
    }
    if (!consequences.includes(consequence as TriggerConsequence)) {
      throw new Error(`Rule ${index + 1} has invalid consequence.`)
    }

    return {
      family: family as TriggerFamily,
      name: stringField(item.name, String(family).replaceAll('_', ' ')),
      description: stringField(item.description),
      metricKey: stringField(item.metricKey, 'dscr'),
      operator: operator as TriggerOperator,
      threshold: numberField(item.threshold),
      thresholdUnit: stringField(item.thresholdUnit, 'x'),
      lookbackPeriods: Math.max(1, Math.round(numberField(item.lookbackPeriods, 1) ?? 1)),
      consequence: consequence as TriggerConsequence,
      sectionReference: stringField(item.sectionReference),
      sourceText: stringField(item.sourceText),
      extractionConfidence: Math.min(1, Math.max(0, numberField(item.extractionConfidence, 0.7) ?? 0.7)),
      watchBuffer: 0.1,
    }
  })
}

export function heuristicExtractRules(documentText: string): ExtractedRuleCandidate[] {
  const source = documentText
  const includes = (needle: string) => source.toLowerCase().includes(needle.toLowerCase())
  const rules: ExtractedRuleCandidate[] = []

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

  return rules
}

export async function extractRulesWithAnthropic(documentText: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your-anthropic-key') return heuristicExtractRules(documentText)

  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildExtractionPrompt(documentText) }],
  })

  const text = message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  return validateExtractedRules(JSON.parse(text) as unknown)
}
