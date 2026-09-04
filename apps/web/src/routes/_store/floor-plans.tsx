import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_store/floor-plans')({
  component: FloorPlansLayout,
})

function FloorPlansLayout() {
  return <Outlet />
}
