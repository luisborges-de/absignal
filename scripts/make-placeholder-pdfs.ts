/**
 * Generates minimal single-page placeholder presale PDFs for each demo deal.
 * Each file carries realistic covenant language so the extraction pipeline has
 * something meaningful to parse, plus a banner noting it should be swapped for
 * a real presale before the demo.
 *
 * Uses pdf-lib (dev dependency, this script only): hand-rolled PDF bytes are
 * rejected by the pdf.js build bundled in pdf-parse.
 *
 * Usage: npx tsx scripts/make-placeholder-pdfs.ts
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, PDFHexString, StandardFonts } from 'pdf-lib'

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'demo', 'presales')

interface PresaleDoc {
  slug: string
  lines: string[]
}

const docs: PresaleDoc[] = [
  {
    slug: 'centersquare-2025-2',
    lines: [
      '*** PLACEHOLDER - Real presale to be replaced before demo ***',
      '',
      'Centersquare Issuer LLC, Series 2025-2 - Presale Excerpt',
      'Sponsor: Centersquare Investment Management',
      'Total issuance: $940,000,000 across 26 colocation data centers (485 MW).',
      'Closing date: 2025-03-15. Anticipated repayment date: 2029-10-15.',
      'Collateral concentrated in Northern Virginia and adjacent markets.',
      '',
      'Section 3.14(b)(ii): If the three-month rolling average DSCR falls below',
      '1.35x, a Cash Trap Event shall occur and all excess cash flow shall be',
      'deposited to the Cash Trap Reserve Account.',
      'Section 3.14(c)(i): If the three-month rolling average DSCR falls below',
      '1.10x, an Early Amortisation Event shall occur.',
      'Section 3.15(a): If the LTV Ratio exceeds 65.0%, excess funds apply to',
      'mandatory deleveraging.',
      'Section 3.16(b): If weighted average occupancy falls below 75.0%, the',
      'issuer shall maintain an Enhanced Liquidity Reserve.',
      'Section 3.17(a): Contracted revenue from any single tenant shall not',
      'exceed 40.0% of total portfolio revenue.',
      'Section 3.18: Portfolio weighted average remaining lease term shall be',
      'maintained above 2.5 years.',
      'Section 3.19: The issuer shall maintain an Operating Expense Reserve of',
      'at least $6,000,000 at all times.',
    ],
  },
  {
    slug: 'vantage-2025-1',
    lines: [
      '*** PLACEHOLDER - Real presale to be replaced before demo ***',
      '',
      'Vantage Data Centers Issuer LLC, Series 2025-1 - Presale Excerpt',
      'Sponsor: Vantage Data Centers',
      'Total issuance: $1,350,000,000 across 12 wholesale data centers (620 MW).',
      'Closing date: 2025-02-20. Anticipated repayment date: 2030-02-15.',
      'Collateral anchored in Santa Clara (Silicon Valley) and Quincy.',
      '',
      'Section 5.02(a): A Cash Trap Condition shall exist if the three-month',
      'average DSCR is less than 1.30x.',
      'Section 5.03: If the Loan-to-Value Ratio exceeds 70.0%, available',
      'amounts shall be applied to deleveraging.',
      'Section 5.05(b): If portfolio occupancy falls below 80.0%, an Occupancy',
      'Reserve Event shall occur.',
      'Section 5.06: The issuer shall maintain a Senior Interest Reserve',
      'Account balance of at least $15,000,000.',
      'Section 5.07: A WALT Trigger Event shall occur if the weighted average',
      'lease term is less than 3.0 years.',
    ],
  },
  {
    slug: 'aligned-2025-1',
    lines: [
      '*** PLACEHOLDER - Real presale to be replaced before demo ***',
      '',
      'Aligned Data Centers Issuer LLC, Series 2025-1 - Presale Excerpt',
      'Sponsor: Aligned Data Centers',
      'Total issuance: $1,050,000,000 across 9 build-to-scale campuses (510 MW).',
      'Closing date: 2025-05-10. Anticipated repayment date: 2030-05-12.',
      'Collateral concentrated in Dallas and Salt Lake City.',
      '',
      'Section 4.01(c): A Cash Sweep Period commences if the three-month',
      'average DSCR is below 1.25x.',
      'Section 4.04(a): If revenue from the largest tenant exceeds 45.0% of',
      'contracted revenue, a Concentration Event shall occur.',
      'Section 4.05: A WALT Trigger Event shall occur if the portfolio weighted',
      'average lease term falls below 3.0 years.',
      'Section 4.06: The issuer shall maintain an Operating Expense Reserve of',
      'at least $6,000,000.',
      'Section 4.08: A Power Cost Event shall occur if the blended power cost',
      'exceeds $0.105 per kWh for any period.',
    ],
  },
  {
    slug: 'switch-2025-2',
    lines: [
      '*** PLACEHOLDER - Real presale to be replaced before demo ***',
      '',
      'Switch ABS Issuer LLC, Series 2025-2 - Presale Excerpt',
      'Sponsor: Switch Inc.',
      'Total issuance: $800,000,000 across 7 hyperscale campuses (410 MW).',
      'Closing date: 2025-04-18. Anticipated repayment date: 2029-04-16.',
      'Collateral concentrated in the Phoenix and Las Vegas corridors.',
      '',
      'Section 6.01(b): A Cash Trap Event shall occur if the three-month',
      'average DSCR falls below 1.30x.',
      'Section 6.04(a): The manager shall maintain a portfolio power usage',
      'effectiveness no greater than 1.40.',
      'Section 6.04(b): A Power Cost Event shall occur if the blended power',
      'cost exceeds $0.095 per kWh.',
      'Section 6.05: If weighted average occupancy falls below 75.0%, an',
      'Occupancy Reserve Event shall occur.',
      'Section 6.06: The issuer shall maintain a Senior Interest Reserve',
      'Account balance of at least $12,000,000.',
    ],
  },
  {
    slug: 'stack-2025-3',
    lines: [
      '*** PLACEHOLDER - Real presale to be replaced before demo ***',
      '',
      'Stack Infrastructure Issuer LLC, Series 2025-3 - Presale Excerpt',
      'Sponsor: Stack Infrastructure',
      'Total issuance: $1,200,000,000 across 14 wholesale data centers (560 MW).',
      'Closing date: 2025-06-25. Anticipated repayment date: 2030-06-25.',
      'Collateral anchored in Chicago and Northern Virginia.',
      '',
      'Section 7.02: A Senior Cash Trap Event shall occur if the Senior DSCR',
      'is less than 1.50x.',
      'Section 7.03: If the LTV Ratio exceeds 68.0%, excess cash flow shall be',
      'applied to mandatory deleveraging.',
      'Section 7.04: Portfolio weighted average remaining lease term shall be',
      'maintained above 2.5 years.',
      'Section 7.05: If the largest tenant exceeds 45.0% of contracted revenue,',
      'a Concentration Event shall occur.',
      'Section 7.06: An Early Amortisation Event shall occur if the three-month',
      'average DSCR falls below 1.05x.',
    ],
  },
]

export async function buildPdf(slug: string, lines: string[]): Promise<Buffer> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([612, 792])

  lines.forEach((line, index) => {
    page.drawText(line, { x: 50, y: 760 - index * 14, size: 10, font })
  })

  // A deterministic per-slug trailer /ID gives each placeholder a unique
  // document fingerprint and keeps re-runs byte-stable.
  const id = PDFHexString.of(crypto.createHash('md5').update(slug).digest('hex').toUpperCase())
  document.context.trailerInfo.ID = document.context.obj([id, id])

  return Buffer.from(await document.save({ useObjectStreams: false }))
}

async function verify(target: string, expectedLine: string) {
  const { extractText } = await import('unpdf')
  const { text } = await extractText(new Uint8Array(fs.readFileSync(target)), { mergePages: true })
  if (!text.includes(expectedLine)) {
    throw new Error(`${target}: parsed text does not contain "${expectedLine}"`)
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  for (const doc of docs) {
    const target = path.join(OUTPUT_DIR, `${doc.slug}.pdf`)
    fs.writeFileSync(target, await buildPdf(doc.slug, doc.lines))
    // Each doc names itself on line 3 — use it to confirm parse round-trips.
    await verify(target, doc.lines[2])
    console.log(`Wrote and verified ${target}`)
  }
}

void main()
