import { cn } from '@/lib/utils'

interface TabItem {
  label: string
  value: string
}

interface TabsProps {
  items: TabItem[]
  active: string
  onChange: (value: string) => void
  className?: string
}

export function Tabs({ items, active, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'min-h-11 rounded-sm px-4 py-2.5 text-btn-sm font-bold',
            active === item.value ? 'bg-nv-ink text-nv-on-dark' : 'bg-transparent text-nv-ink',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
