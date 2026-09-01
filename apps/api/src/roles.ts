export const ROLE = {
  user: "user",
  admin: "admin",
  superAdmin: "super_admin",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const MAX_ADMINS = 3;

export function isAdminRole(role: string | null | undefined): role is Role {
  return role === ROLE.admin || role === ROLE.superAdmin;
}
