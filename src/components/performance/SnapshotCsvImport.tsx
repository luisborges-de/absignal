'use client'

import { FileSpreadsheet, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { evaluationKeys } from '@/hooks/useEvaluations'
import { snapshotKeys, useCreateSnapshot } from '@/hooks/useSnapshots'
import { parseSnapshotCsv } from '@/lib/csv/parseSnapshotCsv'
import { useUIStore } from '@/store/uiStore'
import type { PerformanceSnapshotInput } from '@/lib/types/performance'
import type { TriggerEvaluation } from '@/lib/types/trigger'

export function SnapshotCsvImport({ dealId }: { dealId: string }) {
  const [rows, setRows] = useState<PerformanceSnapshotInput[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [isImporting, setImporting] = useState(false)
  const mutation = useCreateSnapshot(dealId)
  const queryClient = useQueryClient()
  const setSelectedSnapshot = useUIStore((store) => store.setSelectedSnapshot)

  async function handleFile(file: File | undefined) {
    setError(null)
    setProgress(null)
    setRows([])
    if (!file) return
    setFileName(file.name)
    try {
      const parsed = parseSnapshotCsv(await file.text())
      parsed.sort((a, b) => a.periodDate.localeCompare(b.periodDate))
      setRows(parsed)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to parse CSV.')
    }
  }

  async function importRows() {
    setImporting(true)
    setError(null)
    try {
      let lastSnapshotId: string | null = null
      const allEvaluations: TriggerEvaluation[] = []

      for (const [index, input] of rows.entries()) {
        setProgress(`Importing ${index + 1} of ${rows.length} (${input.periodDate})...`)
        const snapshot = await mutation.mutateAsync({ dealId, input })
        lastSnapshotId = snapshot.id

        const response = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId, snapshotId: snapshot.id, snapshot }),
        })
        if (response.ok) {
          const data = (await response.json()) as { evaluations: TriggerEvaluation[] }
          allEvaluations.push(...data.evaluations)
        }
      }

      queryClient.setQueryData<TriggerEvaluation[]>(evaluationKeys.all(dealId), (previous = []) => [
        ...previous.filter((item) => !allEvaluations.some((evaluation) => evaluation.id === item.id)),
        ...allEvaluations,
      ])
      await queryClient.invalidateQueries({ queryKey: snapshotKeys.all(dealId) })
      if (lastSnapshotId) setSelectedSnapshot(lastSnapshotId)
      setProgress(`Imported ${rows.length} snapshots and evaluated all triggers.`)
      setRows([])
      setFileName(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import failed.')
      setProgress(null)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-caption-md font-bold uppercase text-nv-mute">
            <FileSpreadsheet className="h-4 w-4 text-nv-green" aria-hidden="true" />
            CSV Import
          </p>
          <h2 className="mt-1 text-heading-xl font-bold">Bulk snapshot ingestion</h2>
          <p className="mt-2 max-w-3xl text-body-sm text-nv-body">
            Drop a monthly surveillance report as CSV — one row per period, snake_case headers
            matching the template — and every row is imported and evaluated against the approved
            ruleset.
          </p>
        </div>
        <a
          href="/demo/snapshot-template.csv"
          download
          className="text-body-sm font-bold text-nv-link underline"
        >
          Download template
        </a>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void handleFile(event.target.files?.[0])}
          className="block w-full max-w-md rounded-sm border border-nv-hairline bg-nv-canvas p-3 text-body-sm"
        />
        <Button
          icon={<Upload className="h-4 w-4" aria-hidden="true" />}
          disabled={!rows.length || isImporting}
          onClick={() => void importRows()}
        >
          {isImporting ? 'Importing' : `Import ${rows.length || ''} snapshots`.replace('  ', ' ')}
        </Button>
      </div>

      {fileName && rows.length > 0 && (
        <p className="mt-3 text-body-sm text-nv-body">
          Parsed <strong>{rows.length}</strong> rows from {fileName} ({rows[0]?.periodDate} to{' '}
          {rows.at(-1)?.periodDate}).
        </p>
      )}
      {progress && <p className="mt-3 text-body-sm font-bold text-nv-success">{progress}</p>}
      {error && <p className="mt-3 text-body-sm font-bold text-nv-error">{error}</p>}
    </Card>
  )
}
