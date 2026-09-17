import type { Prisma } from "../db";
import { activeEntitlementWhere, entitlementExpiresAt } from "../lib/entitlements";
import type { EntitlementType } from "../schema/enums";
import { isValidEntitlementForProduct } from "../schema/enums";
import type { CheckoutFailure } from "./orders";

export async function getOwnedTypes(
  prisma: Prisma,
  userId: string,
  productId: string,
): Promise<EntitlementType[]> {
  const rows = await prisma.entitlement.findMany({
    where: { userId, productId, ...activeEntitlementWhere() },
    select: { type: true },
  });
  return rows.map((row) => row.type);
}

export async function hasEntitlement(
  prisma: Prisma,
  userId: string,
  productId: string,
  type: EntitlementType,
): Promise<boolean> {
  const count = await prisma.entitlement.count({
    where: { userId, productId, type, ...activeEntitlementWhere() },
  });
  return count > 0;
}

export function listUserEntitlements(prisma: Prisma, userId: string) {
  return prisma.entitlement.findMany({
    where: { userId },
    include: { product: { select: { id: true, slug: true, name: true, type: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function grantEntitlement(
  prisma: Prisma,
  userId: string,
  productId: string,
  type: EntitlementType,
): Promise<{ ok: true; entitlement: { id: string } } | CheckoutFailure> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { ok: false, error: "Product not found", status: 404 };
  if (!isValidEntitlementForProduct(product.type, type)) {
    return { ok: false, error: "Invalid entitlement type for this product", status: 400 };
  }
  const existing = await prisma.entitlement.findFirst({
    where: { userId, productId, type, ...activeEntitlementWhere() },
  });
  if (existing) return { ok: false, error: "User already owns this item", status: 409 };
  const entitlement = await prisma.entitlement.create({
    data: { userId, productId, type, expiresAt: entitlementExpiresAt() },
  });
  return { ok: true, entitlement };
}

export async function revokeEntitlement(
  prisma: Prisma,
  userId: string,
  entitlementId: string,
): Promise<{ ok: true } | CheckoutFailure> {
  const entitlement = await prisma.entitlement.findFirst({
    where: { id: entitlementId, userId },
  });
  if (!entitlement) return { ok: false, error: "Entitlement not found", status: 404 };
  await prisma.entitlement.delete({ where: { id: entitlementId } });
  return { ok: true };
}
