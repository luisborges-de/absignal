'use client'

import { FileText, WandSparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export interface ExtractionDocument {
  documentText: string
  file: File | null
}

interface DocumentUploaderProps {
  onExtract: (document: ExtractionDocument) => Promise<void>
  isExtracting: boolean
}

export function DocumentUploader({ onExtract, isExtracting }: DocumentUploaderProps) {
  const [documentText, setDocumentText] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function loadDemoExcerpt() {
    const response = await fetch('/demo/kbra-dc-methodology-excerpt.txt')
    setDocumentText(await response.text())
    setFile(null)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setFile(file)
    setDocumentText(
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        ? `PDF selected: ${file.name}\n\nText will be parsed server-side before extraction.`
        : await file.text(),
    )
  }

  return (
    <Card className="h-full">
      <div className="mb-6 flex items-center gap-3">
        <FileText className="h-6 w-6 text-nv-green" aria-hidden="true" />
        <div>
          <p className="text-caption-md font-bold uppercase text-nv-mute">Source Document</p>
          <h2 className="text-heading-xl font-bold">KBRA Excerpt</h2>
        </div>
      </div>
      <div className="space-y-4">
        <input
          type="file"
          accept=".txt,.md,.pdf,application/pdf"
          onChange={(event) => void handleFile(event.target.files?.[0])}
          className="block w-full rounded-sm border border-nv-hairline bg-nv-canvas p-3 text-body-sm"
        />
        <Button variant="outline" onClick={() => void loadDemoExcerpt()}>
          Load KBRA Excerpt
        </Button>
        <textarea
          value={documentText}
          onChange={(event) => setDocumentText(event.target.value)}
          className="min-h-[440px] w-full rounded-sm border border-nv-hairline bg-nv-canvas p-4 text-body-sm text-nv-ink outline-none focus:border-2 focus:border-nv-green"
        />
        <Button
          disabled={(!documentText.trim() && !file) || isExtracting}
          icon={<WandSparkles className="h-4 w-4" aria-hidden="true" />}
          onClick={() => void onExtract({ documentText, file })}
        >
          {isExtracting ? 'Extracting' : 'Extract Triggers'}
        </Button>
      </div>
    </Card>
  )
}
