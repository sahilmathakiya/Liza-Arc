import type { Role } from './auth'

export interface AdminListItem {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export interface AdminListResponse {
  admins: AdminListItem[]
  maxAdmins: number
}
