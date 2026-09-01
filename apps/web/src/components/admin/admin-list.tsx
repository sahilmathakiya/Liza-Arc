import { ROLE } from '#/lib/auth'
import type { AdminListItem } from '#/lib/admin'

export function AdminList({ admins }: { admins: AdminListItem[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Admins</h2>
      <ul className="mt-4 divide-y divide-neutral-100">
        {admins.map((admin) => (
          <li key={admin.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-900">{admin.name}</p>
              <p className="truncate text-sm text-neutral-500">{admin.email}</p>
            </div>
            <span
              className={
                admin.role === ROLE.superAdmin
                  ? 'shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white'
                  : 'shrink-0 rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700'
              }
            >
              {admin.role === ROLE.superAdmin ? 'Super admin' : 'Admin'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
