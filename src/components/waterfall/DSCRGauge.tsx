import { Card } from '@/components/ui/Card'

export function DSCRGauge({ dscr }: { dscr: number }) {
  const clamped = Math.min(2.5, Math.max(0, dscr))
  const position = (clamped / 2.5) * 100

  return (
    <Card>
      <p className="text-caption-md font-bold uppercase text-nv-mute">DSCR Gauge</p>
      <h2 className="mt-1 text-heading-xl font-bold">{dscr.toFixed(2)}x</h2>
      <div className="mt-8">
        <div className="relative h-8 rounded-sm bg-nv-soft">
          <div className="absolute left-0 top-0 h-8 w-[44%] bg-nv-error" />
          <div className="absolute left-[44%] top-0 h-8 w-[10%] bg-nv-warning" />
          <div className="absolute left-[54%] top-0 h-8 w-[46%] bg-nv-success" />
          <div
            className="absolute -top-3 h-14 w-1 bg-nv-ink"
            style={{ left: `calc(${position}% - 2px)` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-caption-sm text-nv-mute">
          <span>0.0x</span>
          <span>1.10x</span>
          <span>1.35x</span>
          <span>2.5x</span>
        </div>
      </div>
    </Card>
  )
}
