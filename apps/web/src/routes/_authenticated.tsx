import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '#/lib/auth'

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }
    return { session }
  },
})
