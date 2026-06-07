import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  default: 'text-nv-body',
  success: 'text-nv-success',
  warning: 'text-nv-warning',
  error: 'text-nv-error',
}

export function Badge({ children, variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm bg-nv-soft px-2.5 py-1 text-[14px] font-bold uppercase',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
