import { Card } from '@/components/ui/Card'
import type { WaterfallSummary } from '@/lib/types/waterfall'

export function WaterfallDiagram({ summary }: { summary: WaterfallSummary }) {
  const cashTrap = summary.state === 'CASH_TRAP' || summary.state === 'EARLY_AMORTISATION'

  return (
    <Card className="overflow-hidden">
      <div className="mb-6">
        <p className="text-caption-md font-bold uppercase text-nv-mute">Cash Flow Priority</p>
        <h2 className="mt-1 text-heading-xl font-bold">Waterfall Diagram</h2>
      </div>
      <svg viewBox="0 0 920 440" role="img" aria-label="ABS waterfall diagram" className="h-auto w-full">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#76b900" />
          </marker>
          <marker id="blocked-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#e52020" />
          </marker>
        </defs>
        <rect x="20" y="20" width="220" height="64" fill="#000000" />
        <text x="40" y="58" fill="#ffffff" fontSize="18" fontWeight="700">
          Available Funds
        </text>
        {summary.layers.map((layer, index) => {
          const y = 34 + index * 76
          return (
            <g key={layer.id}>
              <line
                x1="240"
                y1="52"
                x2="360"
                y2={y + 30}
                stroke={layer.blocked ? '#e52020' : '#76b900'}
                strokeWidth="3"
                strokeDasharray={layer.blocked ? '8 8' : undefined}
                markerEnd={layer.blocked ? 'url(#blocked-arrow)' : 'url(#arrow)'}
              />
              <rect
                x="360"
                y={y}
                width="260"
                height="60"
                fill={layer.blocked ? '#fff5f5' : '#ffffff'}
                stroke={layer.blocked ? '#e52020' : '#cccccc'}
              />
              <text x="382" y={y + 26} fill="#000000" fontSize="16" fontWeight="700">
                {layer.label}
              </text>
              <text x="382" y={y + 46} fill="#757575" fontSize="12">
                ${(layer.amount / 1_000_000).toFixed(0)}M
              </text>
              {layer.blocked && (
                <text x="650" y={y + 36} fill="#e52020" fontSize="13" fontWeight="700">
                  BLOCKED
                </text>
              )}
            </g>
          )
        })}
        {cashTrap && (
          <g>
            <rect x="620" y="318" width="270" height="64" fill="#000000" stroke="#76b900" />
            <text x="642" y="344" fill="#76b900" fontSize="14" fontWeight="700">
              DIVERTED TO SENIOR PRINCIPAL
            </text>
            <text x="642" y="366" fill="#ffffff" fontSize="12">
              Class B and Residual cash flows trapped
            </text>
          </g>
        )}
      </svg>
    </Card>
  )
}
