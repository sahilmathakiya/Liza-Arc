export const ENTITLEMENT_VALIDITY_DAYS = 180;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function entitlementExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + ENTITLEMENT_VALIDITY_DAYS * DAY_IN_MS);
}

/**
 * Matches entitlements that still grant access. `null` means the grant never
 * expires (legacy rows / explicit permanent grants).
 */
export function activeEntitlementWhere(now: Date = new Date()) {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}
