import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/moat')({
  component: MoatLayout,
})

function MoatLayout() {
  return <Outlet />
}
