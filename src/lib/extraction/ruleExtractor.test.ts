import { describe, expect, it } from 'vitest'
import {
  MAX_OPENAI_PDF_FILE_BYTES,
  heuristicExtractRules,
  assertPdfFileWithinOpenAILimit,
  isFallbackEligiblePdfError,
  selectRelevantSections,
  validateDealMetadata,
  validateExtractedRules,
  validateExtractedSnapshot,
  mergeExtractedRules,
} from './ruleExtractor'

describe('validateDealMetadata', () => {
  it('keeps well-formed fields and normalizes the market value', () => {
    const metadata = validateDealMetadata({
      name: 'Switch ABS Issuer LLC, Series 2025-2',
      issuer: 'Switch Inc.',
      market: 'phoenix',
      totalIssuanceMn: 800,
      assetCount: 7.4,
      closingDate: '2025-04-18',
      arDate: '2029-04-16',
      collateralDescription: '7 hyperscale campuses',
    })

    expect(metadata).toEqual({
      name: 'Switch ABS Issuer LLC, Series 2025-2',
      issuer: 'Switch Inc.',
      market: 'PHOENIX',
      totalIssuanceMn: 800,
      assetCount: 7,
      closingDate: '2025-04-18',
      arDate: '2029-04-16',
      collateralDescription: '7 hyperscale campuses',
    })
  })

  it('maps unknown markets to NORTHERN_VIRGINIA and drops malformed fields', () => {
    const metadata = validateDealMetadata({
      market: 'Atlanta',
      closingDate: 'April 2025',
      totalIssuanceMn: -5,
      assetCount: 'seven',
    })

    expect(metadata.market).toBe('NORTHERN_VIRGINIA')
    expect(metadata.closingDate).toBeUndefined()
    expect(metadata.totalIssuanceMn).toBeUndefined()
    expect(metadata.assetCount).toBeUndefined()
  })

  it('returns an empty object for non-object input', () => {
    expect(validateDealMetadata(null)).toEqual({})
    expect(validateDealMetadata('text')).toEqual({})
  })
})

describe('selectRelevantSections', () => {
  it('returns small documents verbatim', () => {
    const text = 'If DSCR falls below 1.35x a Cash Trap Event occurs.'
    expect(selectRelevantSections(text)).toBe(text)
  })

  it('trims oversized documents while keeping covenant/waterfall anchors', () => {
    const filler = 'lorem ipsum dolor sit amet '.repeat(30_000) // ~810k chars
    const doc = 'PRIORITY OF PAYMENTS — the cash flow waterfall section. ' + filler
    const reduced = selectRelevantSections(doc)

    expect(reduced.length).toBeLessThan(doc.length)
    expect(reduced.length).toBeLessThanOrEqual(360_000)
    expect(reduced.toLowerCase()).toContain('priority of payments')
  })
})

describe('PDF fallback guards', () => {
  it('classifies encrypted and unreadable parser errors as OpenAI fallback candidates', () => {
    expect(isFallbackEligiblePdfError(new Error('PasswordException: No password given'))).toBe(true)
    expect(isFallbackEligiblePdfError(new Error('InvalidPDFException: corrupt document'))).toBe(true)
    expect(isFallbackEligiblePdfError(new Error('Could not read this PDF because it may be scanned images'))).toBe(true)
    expect(isFallbackEligiblePdfError(new Error('Network unavailable'))).toBe(false)
  })

  it('guards the OpenAI PDF file input size limit', () => {
    expect(() => assertPdfFileWithinOpenAILimit(MAX_OPENAI_PDF_FILE_BYTES)).not.toThrow()
    expect(() => assertPdfFileWithinOpenAILimit(MAX_OPENAI_PDF_FILE_BYTES + 1)).toThrow('50 MB')
  })
})

describe('validateExtractedSnapshot', () => {
  it('keeps valid numeric fields, rounds tenantCount, and drops bad values', () => {
    const snapshot = validateExtractedSnapshot({
      periodDate: '2025-06-30',
      occupancyRate: 0.92,
      tenantCount: 12.6,
      appraisedValue: 'NA',
      dscr: 1.4,
      junk: 'ignore me',
    })

    expect(snapshot.periodDate).toBe('2025-06-30')
    expect(snapshot.occupancyRate).toBe(0.92)
    expect(snapshot.tenantCount).toBe(13)
    expect(snapshot.appraisedValue).toBeUndefined()
    expect('dscr' in snapshot).toBe(false)
    expect('junk' in snapshot).toBe(false)
  })

  it('drops malformed dates and returns an empty object for non-objects', () => {
    expect(validateExtractedSnapshot({ periodDate: 'June 2025' }).periodDate).toBeUndefined()
    expect(validateExtractedSnapshot(null)).toEqual({})
    expect(validateExtractedSnapshot('text')).toEqual({})
  })
})

describe('heuristicExtractRules', () => {
  it('extracts DSCR cash trap and LTV sweep rules from placeholder covenant language', () => {
    const rules = heuristicExtractRules(
      'If the three-month rolling average DSCR falls below 1.35x, a Cash Trap Event shall occur. ' +
        'If the LTV Ratio exceeds 65.0%, excess funds apply to mandatory deleveraging.',
    )

    expect(rules.map((rule) => rule.family)).toEqual(
      expect.arrayContaining(['DSCR_CASH_TRAP', 'LTV_SWEEP']),
    )
  })

  it('supplements Sabey-style S&P presale waterfall and draw-condition triggers', () => {
    const rules = heuristicExtractRules(
      'Draw conditions for the variable-funding notes require post-draw maintenance of a maximum 70% LTV ratio and a minimum 1.80x three-month average DSCR. ' +
        'The series 2022-1 transaction introduced a PIK period trigger as a structural mechanism in the waterfall. ' +
        'The PIK period is in effect when any class A notes are outstanding and the three-month average amortization DSCR is below 1.30x for any of the past 12 consecutive months. ' +
        'A cash trap condition will occur if the three-month average amortization DSCR is less than 1.30x (the cash trap amortization DSCR), and it will continue until it is above 1.30x for two consecutive months. ' +
        'An amortization period will occur if the three-month average amortization DSCR is less than 1.20x (the minimum amortization DSCR), and it will continue until it is above 1.20x for two consecutive months. ' +
        'If an amortization period is not in effect and no event of default has occurred and is continuing, an amount equal to any class A LTV test sweep amount applies as of the application date.',
    )

    expect(rules).toHaveLength(6)
    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: 'ADDITIONAL_ISSUANCE',
          metricKey: 'ltv',
          operator: 'GT',
          threshold: 0.7,
          consequence: 'ISSUANCE_BLOCKED',
        }),
        expect.objectContaining({
          family: 'ADDITIONAL_ISSUANCE',
          metricKey: 'dscr',
          operator: 'LT',
          threshold: 1.8,
          consequence: 'ISSUANCE_BLOCKED',
        }),
        expect.objectContaining({
          family: 'DSCR_SENIOR_CASH_TRAP',
          metricKey: 'dscr',
          operator: 'LT',
          threshold: 1.3,
          consequence: 'RATE_STEP_UP',
        }),
        expect.objectContaining({
          family: 'DSCR_CASH_TRAP',
          metricKey: 'dscr',
          operator: 'LT',
          threshold: 1.3,
          consequence: 'CASH_TRAP',
        }),
        expect.objectContaining({
          family: 'DSCR_EARLY_AMORTISATION',
          metricKey: 'dscr',
          operator: 'LT',
          threshold: 1.2,
          consequence: 'EARLY_AMORTISATION',
        }),
        expect.objectContaining({
          family: 'LTV_SWEEP',
          metricKey: 'ltv',
          operator: 'GT',
          threshold: 0.7,
          consequence: 'MANDATORY_DELEVERAGING',
        }),
      ]),
    )
  })
})

describe('mergeExtractedRules', () => {
  it('drops model-created draw-condition duplicates once deterministic VFN rules exist', () => {
    const modelRules = validateExtractedRules([
      {
        family: 'LTV_SWEEP',
        name: 'Maximum LTV Ratio Draw Condition',
        description: 'Draw conditions for the variable-funding notes require post-draw maintenance of a maximum 70% LTV ratio.',
        metricKey: 'ltv',
        operator: 'GT',
        threshold: 0.7,
        thresholdUnit: 'x',
        lookbackPeriods: 1,
        consequence: 'MANDATORY_DELEVERAGING',
        sectionReference: 'Strengths',
        sourceText: 'Draw conditions for the variable-funding notes, which require post-draw maintenance of a maximum 70% LTV ratio',
        extractionConfidence: 0.95,
      },
      {
        family: 'DSCR_CASH_TRAP',
        name: 'Amortization DSCR Cash Trap Condition',
        description: 'A cash trap condition will occur if the three-month average amortization DSCR is less than 1.30x.',
        metricKey: 'dscr',
        operator: 'LT',
        threshold: 1.3,
        thresholdUnit: 'x',
        lookbackPeriods: 3,
        consequence: 'CASH_TRAP',
        sectionReference: 'Waterfall',
        sourceText: 'A cash trap condition will occur if the three-month average amortization DSCR is less than 1.30x',
        extractionConfidence: 0.95,
      },
    ])
    const supplemental = heuristicExtractRules(
      'Draw conditions for the variable-funding notes require post-draw maintenance of a maximum 70% LTV ratio and a minimum 1.80x three-month average DSCR. ' +
        'A cash trap condition will occur if the three-month average amortization DSCR is less than 1.30x (the cash trap amortization DSCR). ' +
        'If an amortization period is not in effect and no event of default has occurred and is continuing, an amount equal to any class A LTV test sweep amount applies as of the application date.',
    )

    const merged = mergeExtractedRules(modelRules, supplemental)

    expect(merged.map((rule) => rule.name)).not.toContain('Maximum LTV Ratio Draw Condition')
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'VFN Post-Draw LTV Condition', family: 'ADDITIONAL_ISSUANCE' }),
        expect.objectContaining({ name: 'Class A LTV Test Sweep', family: 'LTV_SWEEP' }),
        expect.objectContaining({ name: 'Amortization DSCR Cash Trap Condition', family: 'DSCR_CASH_TRAP' }),
      ]),
    )
    expect(merged.find((rule) => rule.name === 'Class A LTV Test Sweep')?.thresholdUnit).toBe('%')
  })
})
