import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_store/interiors')({
  component: InteriorsLayout,
})

function InteriorsLayout() {
  return <Outlet />
}
