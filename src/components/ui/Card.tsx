import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CornerSquare } from './CornerSquare'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  dark?: boolean
  cornerPosition?: string
  hideCorner?: boolean
}

export function Card({
  children,
  className,
  dark = false,
  cornerPosition = 'top-0 left-0',
  hideCorner = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'relative rounded-sm border p-6',
        dark
          ? 'border-nv-hairline-strong bg-nv-elevated text-nv-on-dark'
          : 'border-nv-hairline bg-nv-canvas text-nv-ink',
        className,
      )}
      {...props}
    >
      {!hideCorner && <CornerSquare position={cornerPosition} />}
      {children}
    </div>
  )
}
