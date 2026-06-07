'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import type { PerformanceSnapshot } from '@/lib/types/performance'

interface MetricTrendChartProps {
  title: string
  data: PerformanceSnapshot[]
  metric: keyof Pick<
    PerformanceSnapshot,
    'dscr' | 'occupancyRate' | 'ltv' | 'topTenantRevenuePct'
  >
  thresholds?: Array<{ value: number; label: string; color: string }>
  valueFormatter?: (value: number) => string
}

export function MetricTrendChart({
  title,
  data,
  metric,
  thresholds = [],
  valueFormatter = (value) => value.toFixed(2),
}: MetricTrendChartProps) {
  const chartData = data.map((snapshot) => ({
    period: new Date(snapshot.periodDate).toLocaleDateString('en-US', { month: 'short' }),
    value: snapshot[metric],
  }))

  return (
    <Card className="min-h-[320px]">
      <h3 className="mb-6 text-card-title font-bold">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#cccccc" strokeDasharray="2 2" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={valueFormatter} width={48} />
            <Tooltip formatter={(value: number) => valueFormatter(value)} />
            {thresholds.map((threshold) => (
              <ReferenceLine
                key={threshold.label}
                y={threshold.value}
                stroke={threshold.color}
                strokeDasharray="4 4"
                label={{ value: threshold.label, fontSize: 11 }}
              />
            ))}
            <Line type="monotone" dataKey="value" stroke="#76b900" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
