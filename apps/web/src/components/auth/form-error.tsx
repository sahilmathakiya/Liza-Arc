import { ErrorNote } from '#/components/ui/feedback'

export function FormError({ message }: { message: string | null }) {
  return <ErrorNote message={message} />
}
