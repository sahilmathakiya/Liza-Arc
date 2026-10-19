import { isPrismaError, type Prisma } from "../db";
import type { AssetKind } from "../lib/r2";
import { legacyPreviewDerivativeKeys } from "../lib/r2";
import { slugify } from "../lib/slug";
import type { EntitlementType, ProductType } from "../schema/enums";
import type {
  CreateProductInput,
  FloorPlanListQuery,
  InteriorPlanListQuery,
  UpdateFloorPlanProductInput,
  UpdateInteriorPlanProductInput,
} from "../schema/product";

const DETAIL_INCLUDE = { floorPlan: true, interiorPlan: true } as const;

export function getProduct(prisma: Prisma, id: string) {
  return prisma.product.findUnique({ where: { id }, include: DETAIL_INCLUDE });
}

export type ProductWithDetails = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

function insertProduct(prisma: Prisma, input: CreateProductInput, slug: string) {
  const base = {
    slug,
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    published: input.published ?? false,
  };
  if (input.type === "FLOOR_PLAN") {
    return prisma.product.create({
      data: { ...base, floorPlan: { create: { ...input.details } } },
      include: DETAIL_INCLUDE,
    });
  }
  return prisma.product.create({
    data: { ...base, interiorPlan: { create: { ...input.details } } },
    include: DETAIL_INCLUDE,
  });
}

export async function createProduct(prisma: Prisma, input: CreateProductInput) {
  const slug = input.slug ?? slugify(input.name);
  try {
    return await insertProduct(prisma, input, slug);
  } catch (error) {
    if (!isPrismaError(error, "P2002")) throw error;
    return insertProduct(prisma, input, `${slug}-${Date.now().toString(36)}`);
  }
}

function productPatchData(patch: {
  name?: string;
  slug?: string;
  description?: string | null;
  published?: boolean;
}) {
  return {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.slug !== undefined && { slug: patch.slug }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.published !== undefined && { published: patch.published }),
  };
}

export async function updateFloorPlanProduct(
  prisma: Prisma,
  product: ProductWithDetails,
  patch: UpdateFloorPlanProductInput,
) {
  const data = productPatchData(patch);
  if (Object.keys(data).length > 0) {
    await prisma.product.update({ where: { id: product.id }, data });
  }
  if (patch.details) {
    await prisma.floorPlan.update({ where: { productId: product.id }, data: { ...patch.details } });
  }
  return getProduct(prisma, product.id);
}

export async function updateInteriorPlanProduct(
  prisma: Prisma,
  product: ProductWithDetails,
  patch: UpdateInteriorPlanProductInput,
) {
  const data = productPatchData(patch);
  if (Object.keys(data).length > 0) {
    await prisma.product.update({ where: { id: product.id }, data });
  }
  if (patch.details) {
    await prisma.interiorPlan.update({ where: { productId: product.id }, data: { ...patch.details } });
  }
  return getProduct(prisma, product.id);
}

export async function listAdminProducts(
  prisma: Prisma,
  opts: { type?: ProductType; page: number; limit: number },
) {
  const where = opts.type ? { type: opts.type } : {};
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ]);
  return { total, page: opts.page, limit: opts.limit, products };
}

export type SwapResult = { ok: true; oldKey: string | null } | { ok: false };

/**
 * Points the product at a newly stored asset using compare-and-set: the row is
 * only updated if it still holds the key we read at the start of the request.
 * If another upload won the race, nothing is written and the caller discards
 * its object, so the DB and R2 can never disagree about which file is current.
 * Image kinds also flip the derivative status to PENDING atomically.
 */
export async function swapAssetKey(
  prisma: Prisma,
  product: ProductWithDetails,
  kind: AssetKind,
  key: string,
): Promise<SwapResult> {
  const productId = product.id;
  if (product.type === "FLOOR_PLAN" && product.floorPlan && kind === "floor-plan") {
    const oldKey = product.floorPlan.floorPlanKey;
    const { count } = await prisma.floorPlan.updateMany({
      where: { productId, floorPlanKey: oldKey },
      data: { floorPlanKey: key },
    });
    return count === 1 ? { ok: true, oldKey } : { ok: false };
  }
  if (product.type === "FLOOR_PLAN" && product.floorPlan && kind === "elevation") {
    const oldKey = product.floorPlan.elevationKey;
    const { count } = await prisma.floorPlan.updateMany({
      where: { productId, elevationKey: oldKey },
      data: { elevationKey: key, thumbnailStatus: "PENDING" },
    });
    return count === 1 ? { ok: true, oldKey } : { ok: false };
  }
  if (product.type === "INTERIOR_PLAN" && product.interiorPlan && kind === "preview") {
    const oldKey = product.interiorPlan.previewKey;
    const { count } = await prisma.interiorPlan.updateMany({
      where: { productId, previewKey: oldKey },
      data: { previewKey: key, thumbnailStatus: "PENDING" },
    });
    return count === 1 ? { ok: true, oldKey } : { ok: false };
  }
  if (product.type === "INTERIOR_PLAN" && product.interiorPlan && kind === "working-drawing") {
    const oldKey = product.interiorPlan.workingDrawingKey;
    const { count } = await prisma.interiorPlan.updateMany({
      where: { productId, workingDrawingKey: oldKey },
      data: { workingDrawingKey: key },
    });
    return count === 1 ? { ok: true, oldKey } : { ok: false };
  }
  throw new Error(`Asset kind "${kind}" does not match product type "${product.type}"`);
}

/**
 * Stores a freshly generated elevation thumbnail, but only if the elevation it
 * was made from is still current and nobody stored a newer thumbnail meanwhile.
 */
export async function commitElevationThumb(
  prisma: Prisma,
  productId: string,
  sourceKey: string,
  expectedThumbKey: string | null,
  thumbKey: string,
): Promise<boolean> {
  const { count } = await prisma.floorPlan.updateMany({
    where: { productId, elevationKey: sourceKey, elevationThumbKey: expectedThumbKey },
    data: { elevationThumbKey: thumbKey, thumbnailStatus: "READY" },
  });
  return count === 1;
}

export async function commitPreviewDerivatives(
  prisma: Prisma,
  productId: string,
  sourceKey: string,
  expected: { cardKey: string | null; heroKey: string | null },
  next: { cardKey: string; heroKey: string },
): Promise<boolean> {
  const { count } = await prisma.interiorPlan.updateMany({
    where: {
      productId,
      previewKey: sourceKey,
      previewCardKey: expected.cardKey,
      previewHeroKey: expected.heroKey,
    },
    data: { previewCardKey: next.cardKey, previewHeroKey: next.heroKey, thumbnailStatus: "READY" },
  });
  return count === 1;
}

/** Marks derivative generation as failed, only if the source is still current. */
export async function markDerivativesFailed(
  prisma: Prisma,
  type: ProductType,
  productId: string,
  sourceKey: string,
): Promise<void> {
  if (type === "FLOOR_PLAN") {
    await prisma.floorPlan.updateMany({
      where: { productId, elevationKey: sourceKey },
      data: { thumbnailStatus: "FAILED" },
    });
    return;
  }
  await prisma.interiorPlan.updateMany({
    where: { productId, previewKey: sourceKey },
    data: { thumbnailStatus: "FAILED" },
  });
}

export function collectAssetKeys(product: ProductWithDetails): string[] {
  const floorPlan = product.floorPlan;
  const interiorPlan = product.interiorPlan;
  return [
    floorPlan?.floorPlanKey,
    floorPlan?.elevationKey,
    floorPlan?.elevationThumbKey,
    interiorPlan?.previewKey,
    interiorPlan?.workingDrawingKey,
    interiorPlan?.previewCardKey,
    interiorPlan?.previewHeroKey,
    ...(interiorPlan ? legacyPreviewDerivativeKeys(product.id) : []),
  ].filter((key): key is string => Boolean(key));
}

export async function deleteProduct(prisma: Prisma, id: string) {
  const product = await getProduct(prisma, id);
  if (!product) return { ok: false as const, error: "not-found" as const };
  const owners = await prisma.entitlement.count({ where: { productId: id } });
  if (owners > 0) return { ok: false as const, error: "owned" as const };
  const orderItems = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItems > 0) return { ok: false as const, error: "ordered" as const };
  await prisma.product.delete({ where: { id } });
  return { ok: true as const, keys: collectAssetKeys(product) };
}

function range(min?: number, max?: number) {
  if (min === undefined && max === undefined) return undefined;
  return { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) };
}

export async function listPublicFloorPlans(prisma: Prisma, query: FloorPlanListQuery) {
  const lengthFt = range(query.minLengthFt, query.maxLengthFt);
  const widthFt = range(query.minWidthFt, query.maxWidthFt);
  const floorAreaSqFt = range(query.minAreaSqFt, query.maxAreaSqFt);
  const where = {
    published: true,
    type: "FLOOR_PLAN" as const,
    ...(query.q && { name: { contains: query.q, mode: "insensitive" as const } }),
    floorPlan: {
      ...(lengthFt && { lengthFt }),
      ...(widthFt && { widthFt }),
      ...(floorAreaSqFt && { floorAreaSqFt }),
    },
  };
  const orderBy =
    query.sort === "createdAt"
      ? { createdAt: query.order }
      : query.sort === "floorAreaSqFt"
        ? { floorPlan: { floorAreaSqFt: query.order } }
        : query.sort === "lengthFt"
          ? { floorPlan: { lengthFt: query.order } }
          : { floorPlan: { widthFt: query.order } };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      include: DETAIL_INCLUDE,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  const products = rows.flatMap((product) => {
    const floorPlan = product.floorPlan;
    if (!floorPlan) return [];
    return [
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        lengthFt: floorPlan.lengthFt,
        widthFt: floorPlan.widthFt,
        floorAreaSqFt: floorPlan.floorAreaSqFt,
        bathrooms: floorPlan.bathrooms,
        bedrooms: floorPlan.bedrooms,
        floors: floorPlan.floors,
        floorPlanPriceCents: floorPlan.floorPlanPriceCents,
        elevationPriceCents: floorPlan.elevationPriceCents,
        bundlePriceCents: floorPlan.bundlePriceCents,
        hasFloorPlan: Boolean(floorPlan.floorPlanKey),
        hasElevation: Boolean(floorPlan.elevationKey),
        hasThumbnail: Boolean(floorPlan.elevationThumbKey),
        thumbnailVersion: floorPlan.elevationThumbKey,
      },
    ];
  });
  return { total, page: query.page, limit: query.limit, products };
}

/**
 * Cache-busting token for public preview URLs: changes whenever the original
 * or its derivatives change. Derived from public (non-paid) keys only.
 */
export function previewVersion(plan: {
  previewKey: string | null;
  previewCardKey: string | null;
  previewHeroKey: string | null;
}): string | null {
  if (!plan.previewKey) return null;
  return [plan.previewKey, plan.previewCardKey, plan.previewHeroKey]
    .map((key) => (key ? key.slice(key.lastIndexOf("/") + 1) : "-"))
    .join(".");
}

export async function listPublicInteriorPlans(prisma: Prisma, query: InteriorPlanListQuery) {
  const where = {
    published: true,
    type: "INTERIOR_PLAN" as const,
    ...(query.q && { name: { contains: query.q, mode: "insensitive" as const } }),
    interiorPlan: {
      ...(query.category && { category: query.category }),
    },
  };
  const orderBy = query.sort === "name" ? { name: query.order } : { createdAt: query.order };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      include: DETAIL_INCLUDE,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);
  const products = rows.flatMap((product) => {
    const interiorPlan = product.interiorPlan;
    if (!interiorPlan) return [];
    return [
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        category: interiorPlan.category,
        workingDrawingPriceCents: interiorPlan.workingDrawingPriceCents,
        hasPreview: Boolean(interiorPlan.previewKey),
        hasWorkingDrawing: Boolean(interiorPlan.workingDrawingKey),
        previewVersion: previewVersion(interiorPlan),
      },
    ];
  });
  return { total, page: query.page, limit: query.limit, products };
}

export async function getPublicProductBySlug(prisma: Prisma, slug: string, userId?: string) {
  const product = await prisma.product.findFirst({
    where: { slug, published: true },
    include: DETAIL_INCLUDE,
  });
  if (!product) return null;

  const floorPlan = product.floorPlan;
  const interiorPlan = product.interiorPlan;

  const owned: EntitlementType[] = [];
  const accessExpiries: { type: EntitlementType; expiresAt: Date | null }[] = [];
  const expiredTypes: EntitlementType[] = [];

  if (userId) {
    const grants = await prisma.entitlement.findMany({
      where: { userId, productId: product.id },
      select: { type: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
    const now = Date.now();
    for (const grant of grants) {
      const active = grant.expiresAt === null || grant.expiresAt.getTime() > now;
      if (active) {
        if (!owned.includes(grant.type)) {
          owned.push(grant.type);
          accessExpiries.push({ type: grant.type, expiresAt: grant.expiresAt });
        }
      } else if (!owned.includes(grant.type) && !expiredTypes.includes(grant.type)) {
        expiredTypes.push(grant.type);
      }
    }
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    type: product.type,
    createdAt: product.createdAt,
    owned,
    accessExpiries,
    expiredTypes,
    floorPlan: floorPlan
      ? {
          lengthFt: floorPlan.lengthFt,
          widthFt: floorPlan.widthFt,
          floorAreaSqFt: floorPlan.floorAreaSqFt,
          bathrooms: floorPlan.bathrooms,
          bedrooms: floorPlan.bedrooms,
          floors: floorPlan.floors,
          floorPlanPriceCents: floorPlan.floorPlanPriceCents,
          elevationPriceCents: floorPlan.elevationPriceCents,
          bundlePriceCents: floorPlan.bundlePriceCents,
          hasFloorPlan: Boolean(floorPlan.floorPlanKey),
          hasElevation: Boolean(floorPlan.elevationKey),
          hasThumbnail: Boolean(floorPlan.elevationThumbKey),
          thumbnailVersion: floorPlan.elevationThumbKey,
        }
      : null,
    interiorPlan: interiorPlan
      ? {
          category: interiorPlan.category,
          workingDrawingPriceCents: interiorPlan.workingDrawingPriceCents,
          hasPreview: Boolean(interiorPlan.previewKey),
          hasWorkingDrawing: Boolean(interiorPlan.workingDrawingKey),
          previewVersion: previewVersion(interiorPlan),
        }
      : null,
  };
}

export type PaidAssetKind = "floor-plan" | "elevation" | "working-drawing";

export async function getDeliverableAsset(
  prisma: Prisma,
  productId: string,
  kind: PaidAssetKind,
): Promise<{ key: string; filename: string; entitlement: EntitlementType; slug: string } | null> {
  const product = await getProduct(prisma, productId);
  if (!product) return null;

  let key: string | null = null;
  let entitlement: EntitlementType = "FLOOR_PLAN";
  if (kind === "floor-plan" && product.floorPlan) {
    key = product.floorPlan.floorPlanKey;
    entitlement = "FLOOR_PLAN";
  } else if (kind === "elevation" && product.floorPlan) {
    key = product.floorPlan.elevationKey;
    entitlement = "ELEVATION_IMAGE";
  } else if (kind === "working-drawing" && product.interiorPlan) {
    key = product.interiorPlan.workingDrawingKey;
    entitlement = "WORKING_DRAWING";
  }
  if (!key) return null;

  const ext = key.includes(".") ? key.slice(key.lastIndexOf(".")) : "";
  return { key, entitlement, filename: `${product.slug}-${kind}${ext}`, slug: product.slug };
}
