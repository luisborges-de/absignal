import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name

  return (
    <label className="block">
      {label && <span className="mb-2 block text-caption-md font-bold uppercase text-nv-body">{label}</span>}
      <input
        id={inputId}
        className={cn(
          'h-11 w-full rounded-sm border border-nv-hairline bg-nv-canvas px-4 py-3 text-body-md text-nv-ink outline-none focus:border-2 focus:border-nv-green',
          className,
        )}
        {...props}
      />
    </label>
  )
}
