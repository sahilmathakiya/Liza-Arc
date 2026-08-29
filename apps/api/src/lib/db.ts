import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | undefined

export function db(url: string) {
  prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  return prisma
}

export const ADMIN = 'ADMIN'
export const SUPER_ADMIN = 'SUPER_ADMIN'

export function findUser(prisma: PrismaClient, id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export function listAdmins(prisma: PrismaClient) {
  return prisma.user.findMany({
    where: { role: ADMIN },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  })
}

export function getAdminControl(prisma: PrismaClient) {
  return prisma.adminControl.findUnique({ where: { id: 1 } })
}

export async function makeSuperAdmin(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.adminControl.updateMany({
      where: { id: 1, adminCount: 0, superAdminId: null },
      data: { superAdminId: userId },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: userId }, data: { role: SUPER_ADMIN } })
    return true
  })
}

export async function makeAdmin(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.adminControl.updateMany({
      where: { id: 1, adminCount: { lt: 3 } },
      data: { adminCount: { increment: 1 } },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: userId }, data: { role: ADMIN } })
    return true
  })
}

export function updateUser(prisma: PrismaClient, id: string, data: { name?: string; email?: string }) {
  return prisma.user.update({ where: { id }, data })
}

export function credentialAccount(prisma: PrismaClient, userId: string) {
  return prisma.account.findFirst({ where: { userId, providerId: 'credential' } })
}

export function updatePassword(prisma: PrismaClient, accountId: string, password: string) {
  return prisma.account.update({ where: { id: accountId }, data: { password } })
}

export function deleteUser(prisma: PrismaClient, id: string) {
  return prisma.user.delete({ where: { id } })
}

export async function deleteAdmin(prisma: PrismaClient, id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id } })
    await tx.adminControl.updateMany({ where: { id: 1, adminCount: { gt: 0 } }, data: { adminCount: { decrement: 1 } } })
  })
}
