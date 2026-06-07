'use client'

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { resolveWaterfallState } from '@/lib/engine/triggerEngine'
import { StatusPill } from '@/components/ui/StatusPill'
import { Card } from '@/components/ui/Card'
import { formatPercent, formatRatio } from '@/lib/utils'
import type { PerformanceSnapshot } from '@/lib/types/performance'
import type { TriggerEvaluation } from '@/lib/types/trigger'

interface SnapshotHistoryTableProps {
  snapshots: PerformanceSnapshot[]
  evaluations: TriggerEvaluation[]
}

export function SnapshotHistoryTable({ snapshots, evaluations }: SnapshotHistoryTableProps) {
  const columns: ColumnDef<PerformanceSnapshot>[] = [
    {
      header: 'Period',
      accessorKey: 'periodDate',
      cell: ({ row }) => new Date(row.original.periodDate).toLocaleDateString('en-US'),
    },
    {
      header: 'DSCR',
      accessorKey: 'dscr',
      cell: ({ row }) => formatRatio(row.original.dscr),
    },
    {
      header: 'Occupancy',
      accessorKey: 'occupancyRate',
      cell: ({ row }) => formatPercent(row.original.occupancyRate),
    },
    {
      header: 'LTV',
      accessorKey: 'ltv',
      cell: ({ row }) => formatPercent(row.original.ltv),
    },
    {
      header: 'Waterfall State',
      cell: ({ row }) => {
        const state = resolveWaterfallState(
          evaluations.filter((evaluation) => evaluation.snapshotId === row.original.id),
        )
        return state.replaceAll('_', ' ')
      },
    },
    {
      header: 'Source',
      accessorKey: 'source',
      cell: ({ row }) => <StatusPill status={row.original.source === 'DEMO' ? 'SAFE' : 'WATCH'} />,
    },
  ]

  const table = useReactTable({ data: snapshots, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-nv-hairline p-6">
        <p className="text-caption-md font-bold uppercase text-nv-mute">Snapshot History</p>
        <h2 className="mt-1 text-heading-xl font-bold">Monthly Performance</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-body-sm">
          <thead className="bg-nv-soft text-caption-md font-bold uppercase text-nv-body">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-6 py-4">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-nv-hairline">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
