import { Outlet, createFileRoute } from '@tanstack/react-router'
import { StoreLayout } from '#/components/layout/store-layout'

export const Route = createFileRoute('/_store')({
  component: StoreGroupLayout,
})

function StoreGroupLayout() {
  return (
    <StoreLayout>
      <Outlet />
    </StoreLayout>
  )
}
