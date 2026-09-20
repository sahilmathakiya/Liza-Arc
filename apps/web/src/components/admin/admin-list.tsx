import { ROLE } from '#/lib/auth'
import type { AdminListItem } from '#/lib/admin'
import { Badge } from '#/components/ui/badge'

export function AdminList({ admins }: { admins: AdminListItem[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-card">
      <h2 className="text-base font-semibold text-ink">Admins</h2>
      <ul className="mt-4 divide-y divide-line">
        {admins.map((admin) => (
          <li key={admin.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{admin.name}</p>
              <p className="truncate text-sm text-ink-soft">{admin.email}</p>
            </div>
            <Badge tone={admin.role === ROLE.superAdmin ? 'dark' : 'neutral'}>
              {admin.role === ROLE.superAdmin ? 'Super admin' : 'Admin'}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
