import type { Prisma } from "../db";
import { activeEntitlementWhere, entitlementExpiresAt } from "../lib/entitlements";
import type { EntitlementType, OrderStatus, ProductType } from "../schema/enums";
import { isValidEntitlementForProduct } from "../schema/enums";
import type { CheckoutInput } from "../schema/order";

export const ENTITLEMENT_DOWNLOAD_KIND: Record<
  EntitlementType,
  "floor-plan" | "elevation" | "working-drawing"
> = {
  FLOOR_PLAN: "floor-plan",
  ELEVATION_IMAGE: "elevation",
  WORKING_DRAWING: "working-drawing",
};

const PRODUCT_REF_SELECT = { id: true, slug: true, name: true, type: true } as const;

const ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: PRODUCT_REF_SELECT },
      entitlement: { select: { expiresAt: true } },
    },
  },
} as const;

interface OrderItemRecord {
  id: string;
  entitlementType: EntitlementType;
  priceCents: number;
  product: { id: string; slug: string; name: string; type: ProductType };
  entitlement: { expiresAt: Date | null } | null;
}

/**
 * Flattens the grant expiry onto each order item so receipts can tell an
 * expired download from an active one.
 */
export function withAccessExpiry<T extends { items: OrderItemRecord[] }>(order: T) {
  return {
    ...order,
    items: order.items.map((item) => ({
      id: item.id,
      entitlementType: item.entitlementType,
      priceCents: item.priceCents,
      product: item.product,
      accessExpiresAt: item.entitlement?.expiresAt ?? null,
    })),
  };
}

export type CheckoutFailure = { ok: false; error: string; status: 400 | 404 | 409 };

function priceFor(product: {
  type: string;
  floorPlan: {
    floorPlanPriceCents: number;
    elevationPriceCents: number;
    floorPlanKey: string | null;
    elevationKey: string | null;
  } | null;
  interiorPlan: { workingDrawingPriceCents: number; workingDrawingKey: string | null } | null;
}, type: EntitlementType): number | null {
  if (product.type === "FLOOR_PLAN" && product.floorPlan) {
    if (type === "FLOOR_PLAN") {
      return product.floorPlan.floorPlanKey ? product.floorPlan.floorPlanPriceCents : null;
    }
    if (type === "ELEVATION_IMAGE") {
      return product.floorPlan.elevationKey ? product.floorPlan.elevationPriceCents : null;
    }
  }
  if (product.type === "INTERIOR_PLAN" && product.interiorPlan) {
    if (type === "WORKING_DRAWING") {
      return product.interiorPlan.workingDrawingKey
        ? product.interiorPlan.workingDrawingPriceCents
        : null;
    }
  }
  return null;
}

export async function priceCart(
  prisma: Prisma,
  userId: string,
  items: CheckoutInput["items"],
): Promise<
  | { ok: true; lines: { productId: string; entitlementType: EntitlementType; priceCents: number }[] }
  | CheckoutFailure
> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { floorPlan: true, interiorPlan: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  const ownedRows = await prisma.entitlement.findMany({
    where: { userId, productId: { in: productIds }, ...activeEntitlementWhere() },
    select: { productId: true, type: true },
  });
  const owned = new Set(ownedRows.map((row) => `${row.productId}:${row.type}`));

  const lines: { productId: string; entitlementType: EntitlementType; priceCents: number }[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product || !product.published) {
      return { ok: false, error: "One of the selected products is not available", status: 400 };
    }
    if (!isValidEntitlementForProduct(product.type, item.entitlementType)) {
      return { ok: false, error: "Invalid item for the selected product", status: 400 };
    }
    if (owned.has(`${item.productId}:${item.entitlementType}`)) {
      return { ok: false, error: "You already own one of the selected items", status: 409 };
    }
    const price = priceFor(product, item.entitlementType);
    if (price == null) {
      return { ok: false, error: "One of the selected items is not available yet", status: 400 };
    }
    lines.push({ productId: item.productId, entitlementType: item.entitlementType, priceCents: price });
  }

  for (const productId of productIds) {
    const floorPlanLine = lines.find(
      (line) => line.productId === productId && line.entitlementType === "FLOOR_PLAN",
    );
    const elevationLine = lines.find(
      (line) => line.productId === productId && line.entitlementType === "ELEVATION_IMAGE",
    );
    const bundlePriceCents = byId.get(productId)?.floorPlan?.bundlePriceCents;
    if (floorPlanLine && elevationLine && bundlePriceCents != null) {
      const combined = floorPlanLine.priceCents + elevationLine.priceCents;
      if (bundlePriceCents < combined) {
        const floorPlanShare = Math.round((bundlePriceCents * floorPlanLine.priceCents) / combined);
        floorPlanLine.priceCents = floorPlanShare;
        elevationLine.priceCents = bundlePriceCents - floorPlanShare;
      }
    }
  }

  return { ok: true, lines };
}

export async function createCheckout(prisma: Prisma, userId: string, items: CheckoutInput["items"]) {
  const priced = await priceCart(prisma, userId, items);
  if (!priced.ok) return priced;
  const subtotalCents = priced.lines.reduce((sum, line) => sum + line.priceCents, 0);
  const order = await prisma.order.create({
    data: {
      userId,
      subtotalCents,
      totalCents: subtotalCents,
      items: {
        create: priced.lines.map((line) => ({
          productId: line.productId,
          entitlementType: line.entitlementType,
          priceCents: line.priceCents,
        })),
      },
    },
    include: ORDER_INCLUDE,
  });
  return { ok: true as const, order };
}

export async function confirmPurchase(prisma: Prisma, orderId: string, paymentRef: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!order) return { ok: false, error: "Order not found", status: 404 } as CheckoutFailure;
  if (order.status === "PAID") {
    if (order.paymentRef === paymentRef) return { ok: true as const, order };
    return { ok: false, error: "Order has already been paid", status: 409 } as CheckoutFailure;
  }
  if (order.status === "FAILED") {
    return { ok: false, error: "This payment failed; please start a new checkout", status: 409 } as CheckoutFailure;
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: "PAID", paymentRef } });
        for (const item of order.items) {
          await tx.entitlement.create({
            data: {
              type: item.entitlementType,
              userId: order.userId,
              productId: item.productId,
              orderItemId: item.id,
              expiresAt: entitlementExpiresAt(),
            },
          });
        }
      },
      { maxWait: 10000, timeout: 30000 },
    );
  } catch (error) {
    const current = await prisma.order.findUnique({ where: { id: orderId } });
    if (current?.status === "PAID" && current.paymentRef === paymentRef) {
      const paidOrder = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
      if (paidOrder) return { ok: true as const, order: paidOrder };
    }
    const message =
      error instanceof Error && error.message.includes("P2002")
        ? "One of these items was purchased in the meantime"
        : "Payment could not be confirmed";
    return { ok: false, error: message, status: 409 } as CheckoutFailure;
  }

  const paidOrder = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!paidOrder) return { ok: false, error: "Order not found", status: 404 } as CheckoutFailure;
  return { ok: true as const, order: paidOrder };
}

export async function failPurchase(prisma: Prisma, orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found", status: 404 } as CheckoutFailure;
  if (order.status === "PAID") {
    return { ok: false, error: "Order has already been paid", status: 409 } as CheckoutFailure;
  }
  if (order.status === "FAILED") return { ok: true as const };
  await prisma.order.update({ where: { id: orderId }, data: { status: "FAILED" } });
  return { ok: true as const };
}

export function listUserOrders(prisma: Prisma, userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export function getUserOrder(prisma: Prisma, orderId: string, userId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: ORDER_INCLUDE,
  });
}

export function findOrderIdByRazorpayOrderId(prisma: Prisma, razorpayOrderId: string) {
  return prisma.order.findFirst({
    where: { razorpayOrderId },
    select: { id: true },
  });
}

export function findOrderIdByReceipt(prisma: Prisma, receipt: string) {
  return prisma.order.findUnique({
    where: { id: receipt },
    select: { id: true },
  });
}

export async function listAdminOrders(
  prisma: Prisma,
  opts: { status?: OrderStatus; page: number; limit: number },
) {
  const where = opts.status ? { status: opts.status } : {};
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ]);
  return { total, page: opts.page, limit: opts.limit, orders };
}

export function getAdminOrder(prisma: Prisma, orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: { select: PRODUCT_REF_SELECT },
          entitlement: { select: { expiresAt: true } },
        },
      },
    },
  });
}

export async function listAdminCustomers(prisma: Prisma, opts: { page: number; limit: number }) {
  const where = { role: "user" };
  const [total, users, spentRows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { _count: { select: { orders: true, entitlements: true } } },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { status: "PAID" },
      _sum: { totalCents: true },
    }),
  ]);
  const spentByUser = new Map(spentRows.map((row) => [row.userId, row._sum.totalCents ?? 0]));
  const customers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    orderCount: user._count.orders,
    entitlementCount: user._count.entitlements,
    spentCents: spentByUser.get(user.id) ?? 0,
  }));
  return { total, page: opts.page, limit: opts.limit, customers };
}

export function getAdminCustomer(prisma: Prisma, userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: "user" },
    include: {
      orders: { include: ORDER_INCLUDE, orderBy: { createdAt: "desc" } },
      entitlements: {
        include: { product: { select: PRODUCT_REF_SELECT } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
