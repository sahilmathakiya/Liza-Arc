import { Skeleton } from '#/components/ui/feedback'
import { Container } from '#/components/ui/layout'

export function CatalogSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <Container className="py-10">
      <div className="border-b border-line pb-6">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Skeleton className="mt-6 h-40 w-full rounded-lg" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-line bg-surface">
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}
