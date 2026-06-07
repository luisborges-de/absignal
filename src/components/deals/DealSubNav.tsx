'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  ['Overview', ''],
  ['AI Extraction', 'extraction'],
  ['Performance Data', 'performance'],
  ['Waterfall', 'waterfall'],
] as const

export function DealSubNav({ dealId }: { dealId: string }) {
  const pathname = usePathname()

  return (
    <nav className="bg-nv-soft">
      <div className="mx-auto flex max-w-content gap-2 overflow-x-auto px-6 py-3">
        {tabs.map(([label, segment]) => {
          const href = segment ? `/deals/${dealId}/${segment}` : `/deals/${dealId}`
          const active = pathname === href

          return (
            <Link
              key={label}
              href={href}
              className={cn(
                'min-h-11 whitespace-nowrap rounded-sm px-4 py-2.5 text-btn-sm font-bold',
                active ? 'bg-nv-ink text-nv-on-dark' : 'bg-transparent text-nv-ink',
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
