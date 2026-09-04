export const PRODUCT_TYPES = ["FLOOR_PLAN", "INTERIOR_PLAN"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const ENTITLEMENT_TYPES = ["FLOOR_PLAN", "ELEVATION_IMAGE", "WORKING_DRAWING"] as const;
export type EntitlementType = (typeof ENTITLEMENT_TYPES)[number];

export const INTERIOR_CATEGORIES = ["KITCHEN", "HALL", "LIVING_ROOM", "BEDROOM"] as const;
export type InteriorCategory = (typeof INTERIOR_CATEGORIES)[number];

export const ORDER_STATUSES = ["PENDING", "PAID", "FAILED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRODUCT_ENTITLEMENTS: Record<ProductType, readonly EntitlementType[]> = {
  FLOOR_PLAN: ["FLOOR_PLAN", "ELEVATION_IMAGE"],
  INTERIOR_PLAN: ["WORKING_DRAWING"],
};

export function entitlementsForProduct(type: ProductType): readonly EntitlementType[] {
  return PRODUCT_ENTITLEMENTS[type];
}

export function isValidEntitlementForProduct(type: ProductType, entitlement: EntitlementType): boolean {
  return PRODUCT_ENTITLEMENTS[type].includes(entitlement);
}
