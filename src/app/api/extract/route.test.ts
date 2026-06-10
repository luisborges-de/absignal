import { afterEach, describe, expect, it, vi } from 'vitest'

const extractTextMock = vi.hoisted(() => vi.fn())
const openAIChatCreateMock = vi.hoisted(() => vi.fn())

vi.mock('unpdf', () => ({
  extractText: extractTextMock,
}))

vi.mock('openai', () => ({
  default: vi.fn(function OpenAIMock() {
    return {
    chat: {
      completions: {
        create: openAIChatCreateMock,
      },
    },
    }
  }),
}))

import { POST } from './route'

function pdfForm(fileName = 'sabey-presale.pdf') {
  const form = new FormData()
  form.set('dealId', 'new')
  form.set('extractDealMetadata', 'true')
  form.set(
    'file',
    new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], fileName, {
      type: 'application/pdf',
    }),
  )
  return form
}

const extractionPayload = {
  dealMetadata: {
    name: 'Sabey Data Center Issuer LLC, Series 2025-1',
    issuer: 'Sabey Data Centers',
    market: 'NORTHERN_VIRGINIA',
    totalIssuanceMn: 500,
    assetCount: 2,
    closingDate: '2025-05-01',
    arDate: '2030-05-01',
    collateralDescription: 'Two data center campuses securing the notes.',
  },
  closingSnapshot: {
    periodDate: '2025-05-01',
    occupancyRate: 0.95,
    leasedCapacityMW: 90,
    totalCapacityMW: 100,
  },
  rules: [
    {
      family: 'DSCR_CASH_TRAP',
      name: 'DSCR Cash Trap',
      description: 'Cash trap if DSCR falls below 1.35x.',
      metricKey: 'dscr',
      operator: 'LT',
      threshold: 1.35,
      thresholdUnit: 'x',
      lookbackPeriods: 1,
      consequence: 'CASH_TRAP',
      sectionReference: 'Presale summary',
      sourceText: 'Cash trap if DSCR falls below 1.35x.',
      extractionConfidence: 0.9,
    },
  ],
}

describe('POST /api/extract', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('falls back to OpenAI PDF file input when local PDF parsing reports password/encryption', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    extractTextMock.mockRejectedValue(new Error('PasswordException: No password given'))
    openAIChatCreateMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(extractionPayload) } }],
    })

    const response = await POST(new Request('http://localhost/api/extract', {
      method: 'POST',
      body: pdfForm(),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.dealMetadata.name).toBe('Sabey Data Center Issuer LLC, Series 2025-1')
    expect(body.candidates).toHaveLength(1)
    expect(body.count).toBe(1)
    expect(openAIChatCreateMock).toHaveBeenCalledTimes(1)
    const request = openAIChatCreateMock.mock.calls[0][0]
    expect(request.messages[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'file',
          file: expect.objectContaining({
            filename: 'sabey-presale.pdf',
            file_data: expect.stringMatching(/^data:application\/pdf;base64,/),
          }),
        }),
      ]),
    )
  })

  it('returns an actionable error when PDF parsing fails and OpenAI fallback is unavailable', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    extractTextMock.mockRejectedValue(new Error('PasswordException: No password given'))

    const response = await POST(new Request('http://localhost/api/extract', {
      method: 'POST',
      body: pdfForm(),
    }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toContain('OPENAI_API_KEY')
    expect(body.error).toContain('paste the document text')
    expect(openAIChatCreateMock).not.toHaveBeenCalled()
  })

  it('returns a specific error when local parsing and AI PDF fallback both fail', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    extractTextMock.mockRejectedValue(new Error('PasswordException: No password given'))
    openAIChatCreateMock.mockRejectedValue(new Error('model could not read the PDF'))

    const response = await POST(new Request('http://localhost/api/extract', {
      method: 'POST',
      body: pdfForm(),
    }))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toContain('Local PDF text parsing failed')
    expect(body.error).toContain('AI PDF fallback failed')
  })

  it('keeps normal text extraction on the existing text path', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const response = await POST(new Request('http://localhost/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: 'new',
        extractDealMetadata: true,
        documentText: 'If the three-month rolling average DSCR falls below 1.35x, a Cash Trap Event shall occur.',
      }),
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.candidates[0].family).toBe('DSCR_CASH_TRAP')
    expect(extractTextMock).not.toHaveBeenCalled()
    expect(openAIChatCreateMock).not.toHaveBeenCalled()
  })
})
