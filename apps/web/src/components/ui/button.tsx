import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[6px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border border-brand bg-brand !text-brand-foreground hover:bg-active active:bg-brand',
        secondary: 'border border-line-strong bg-surface text-ink hover:border-ink-faint hover:bg-surface-muted active:bg-surface',
        ghost: 'text-ink-soft hover:bg-surface-muted hover:text-ink active:text-ink',
        danger: 'border border-olive bg-surface text-ink-soft hover:border-brand/50 hover:bg-surface-muted hover:text-ink',
      },
      size: {
        sm: 'h-9 px-3.5 text-xs',
        md: 'h-10.5 px-4 text-sm',
        lg: 'h-12 px-5 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export function buttonClasses(
  variant: ButtonVariant | null = 'primary',
  size: ButtonSize | null = 'md',
  className = '',
) {
  return cn(buttonVariants({ variant: variant ?? undefined, size: size ?? undefined }), className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />
}
