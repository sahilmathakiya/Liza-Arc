import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="w-full" size="lg">
      {pending ? 'Please wait…' : children}
    </Button>
  )
}
