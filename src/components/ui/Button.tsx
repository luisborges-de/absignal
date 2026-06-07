import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'outline' | 'outline-dark' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'h-11 rounded-sm bg-nv-green px-6 py-2.5 text-btn-md font-bold text-black hover:bg-nv-green-dark',
  outline:
    'h-11 rounded-sm border-2 border-nv-green bg-transparent px-6 py-2.5 text-btn-md font-bold text-nv-ink',
  'outline-dark':
    'h-11 rounded-sm border border-nv-on-dark bg-transparent px-6 py-2.5 text-btn-md font-bold text-nv-on-dark',
  ghost: 'rounded-sm bg-transparent text-btn-md font-bold text-nv-green',
}

export function Button({
  variant = 'primary',
  icon,
  children,
  className,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors',
        disabled
          ? 'h-11 cursor-not-allowed rounded-sm bg-nv-soft px-6 py-2.5 text-btn-md font-bold text-nv-ash'
          : variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
