'use client'

import { Calculator } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { evaluationKeys } from '@/hooks/useEvaluations'
import { useCreateSnapshot } from '@/hooks/useSnapshots'
import { useUIStore } from '@/store/uiStore'
import type { PerformanceSnapshotInput } from '@/lib/types/performance'
import type { TriggerEvaluation } from '@/lib/types/trigger'

interface FormState {
  periodDate: string
  occupancyRate: string
  leasedCapacityMW: string
  totalCapacityMW: string
  contractedRevenue: string
  grossRevenue: string
  operatingExpenses: string
  netCashFlow: string
  scheduledDebtService: string
  seniorDebtService: string
  pueRatio: string
  powerCostPerKwh: string
  topTenantRevenuePct: string
  tenantCount: string
  weightedAvgRemainingLeaseTerm: string
  outstandingBalance: string
  appraisedValue: string
  seniorInterestReserveBalance: string
  expenseReserveBalance: string
  requiredReserveBalance: string
  notes: string
}

const initialState: FormState = {
  periodDate: '2025-10-31',
  occupancyRate: '0.74',
  leasedCapacityMW: '358.9',
  totalCapacityMW: '485',
  contractedRevenue: '11100000',
  grossRevenue: '11300000',
  operatingExpenses: '4315000',
  netCashFlow: '7140000',
  scheduledDebtService: '6000000',
  seniorDebtService: '4800000',
  pueRatio: '1.28',
  powerCostPerKwh: '0.091',
  topTenantRevenuePct: '0.32',
  tenantCount: '40',
  weightedAvgRemainingLeaseTerm: '2.86',
  outstandingBalance: '895000000',
  appraisedValue: '1443548387',
  seniorInterestReserveBalance: '20000000',
  expenseReserveBalance: '6550000',
  requiredReserveBalance: '6000000',
  notes: 'October cash trap test scenario',
}

function numberValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toInput(state: FormState): PerformanceSnapshotInput {
  return {
    periodDate: state.periodDate,
    occupancyRate: numberValue(state.occupancyRate),
    leasedCapacityMW: numberValue(state.leasedCapacityMW),
    totalCapacityMW: numberValue(state.totalCapacityMW),
    contractedRevenue: numberValue(state.contractedRevenue),
    grossRevenue: numberValue(state.grossRevenue),
    operatingExpenses: numberValue(state.operatingExpenses),
    netCashFlow: numberValue(state.netCashFlow),
    scheduledDebtService: numberValue(state.scheduledDebtService),
    seniorDebtService: numberValue(state.seniorDebtService),
    pueRatio: numberValue(state.pueRatio),
    powerCostPerKwh: numberValue(state.powerCostPerKwh),
    topTenantRevenuePct: numberValue(state.topTenantRevenuePct),
    tenantCount: numberValue(state.tenantCount),
    weightedAvgRemainingLeaseTerm: numberValue(state.weightedAvgRemainingLeaseTerm),
    outstandingBalance: numberValue(state.outstandingBalance),
    appraisedValue: numberValue(state.appraisedValue),
    seniorInterestReserveBalance: numberValue(state.seniorInterestReserveBalance),
    expenseReserveBalance: numberValue(state.expenseReserveBalance),
    requiredReserveBalance: numberValue(state.requiredReserveBalance),
    notes: state.notes,
    source: 'MANUAL',
  }
}

export function PerformanceSnapshotForm({ dealId }: { dealId: string }) {
  const [state, setState] = useState(initialState)
  const [message, setMessage] = useState<string | null>(null)
  const mutation = useCreateSnapshot(dealId)
  const queryClient = useQueryClient()
  const setSelectedSnapshot = useUIStore((store) => store.setSelectedSnapshot)

  const computed = useMemo(() => {
    const netCashFlow = numberValue(state.netCashFlow)
    const scheduledDebtService = numberValue(state.scheduledDebtService)
    const seniorDebtService = numberValue(state.seniorDebtService)
    const outstandingBalance = numberValue(state.outstandingBalance)
    const appraisedValue = numberValue(state.appraisedValue)

    return {
      dscr: scheduledDebtService > 0 ? netCashFlow / scheduledDebtService : 0,
      seniorDscr: seniorDebtService > 0 ? netCashFlow / seniorDebtService : 0,
      ltv: appraisedValue > 0 ? outstandingBalance / appraisedValue : 0,
    }
  }, [state])

  function update(name: keyof FormState, value: string) {
    setState((current) => ({ ...current, [name]: value }))
  }

  async function submit() {
    const snapshot = await mutation.mutateAsync({ dealId, input: toInput(state) })
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, snapshotId: snapshot.id, snapshot }),
    })

    if (!response.ok) throw new Error('Evaluation failed.')
    const data = (await response.json()) as { evaluations: TriggerEvaluation[] }
    queryClient.setQueryData<TriggerEvaluation[]>(evaluationKeys.all(dealId), (previous = []) => [
      ...previous.filter((item) => !data.evaluations.some((evaluation) => evaluation.id === item.id)),
      ...data.evaluations,
    ])
    setSelectedSnapshot(snapshot.id)
    setMessage('Snapshot evaluated.')
  }

  const fields: Array<[keyof FormState, string, string]> = [
    ['periodDate', 'Period Date', 'date'],
    ['occupancyRate', 'Occupancy Rate', 'number'],
    ['leasedCapacityMW', 'Leased MW', 'number'],
    ['totalCapacityMW', 'Total MW', 'number'],
    ['contractedRevenue', 'Contracted Revenue', 'number'],
    ['grossRevenue', 'Gross Revenue', 'number'],
    ['operatingExpenses', 'Operating Expenses', 'number'],
    ['netCashFlow', 'Net Cash Flow', 'number'],
    ['scheduledDebtService', 'Debt Service', 'number'],
    ['seniorDebtService', 'Senior Debt Service', 'number'],
    ['pueRatio', 'PUE Ratio', 'number'],
    ['powerCostPerKwh', 'Power $/kWh', 'number'],
    ['topTenantRevenuePct', 'Top Tenant %', 'number'],
    ['tenantCount', 'Tenant Count', 'number'],
    ['weightedAvgRemainingLeaseTerm', 'WART', 'number'],
    ['outstandingBalance', 'Outstanding Balance', 'number'],
    ['appraisedValue', 'Appraised Value', 'number'],
    ['expenseReserveBalance', 'Expense Reserve', 'number'],
  ]

  return (
    <Card>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-caption-md font-bold uppercase text-nv-mute">Performance Snapshot</p>
          <h2 className="mt-1 text-heading-xl font-bold">Calculate & Evaluate</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right text-caption-sm">
          <span>DSCR <strong>{computed.dscr.toFixed(2)}x</strong></span>
          <span>Senior <strong>{computed.seniorDscr.toFixed(2)}x</strong></span>
          <span>LTV <strong>{(computed.ltv * 100).toFixed(1)}%</strong></span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.map(([name, label, type]) => (
          <Input
            key={name}
            label={label}
            type={type}
            step="0.01"
            value={state[name]}
            onChange={(event) => update(name, event.target.value)}
          />
        ))}
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-caption-md font-bold uppercase text-nv-body">Notes</span>
        <textarea
          value={state.notes}
          onChange={(event) => update('notes', event.target.value)}
          className="min-h-24 w-full rounded-sm border border-nv-hairline p-3 outline-none focus:border-2 focus:border-nv-green"
        />
      </label>
      <div className="mt-6 flex items-center gap-4">
        <Button
          icon={<Calculator className="h-4 w-4" aria-hidden="true" />}
          disabled={mutation.isPending}
          onClick={() => void submit()}
        >
          Calculate & Evaluate
        </Button>
        {message && <p className="text-body-sm font-bold text-nv-success">{message}</p>}
      </div>
    </Card>
  )
}
