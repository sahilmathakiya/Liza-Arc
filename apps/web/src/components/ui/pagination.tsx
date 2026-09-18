import { Button } from '#/components/ui/button'

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className = '',
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-between gap-4 ${className}`}
    >
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <p className="text-sm text-ink-soft">
        Page {page} of {totalPages}
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  )
}

export function totalPagesFor(total: number, limit: number): number {
  if (limit <= 0) return 1
  return Math.max(1, Math.ceil(total / limit))
}
