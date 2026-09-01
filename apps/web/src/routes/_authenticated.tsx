import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionSafe } from '#/lib/auth'

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await getSessionSafe()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    return { session }
  },
})
