import { cn } from '@/lib/utils'

interface CornerSquareProps {
  position?: string
  className?: string
}

export function CornerSquare({ position = 'top-0 left-0', className }: CornerSquareProps) {
  return <span aria-hidden="true" className={cn('absolute h-3 w-3 bg-nv-green', position, className)} />
}
