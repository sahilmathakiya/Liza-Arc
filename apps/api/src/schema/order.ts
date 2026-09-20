import { z } from "zod";
import { ENTITLEMENT_TYPES } from "./enums";

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  entitlementType: z.enum(ENTITLEMENT_TYPES),
});

export type CheckoutItem = z.infer<typeof checkoutItemSchema>;

export const checkoutSchema = z
  .object({
    items: z.array(checkoutItemSchema).min(1).max(10),
  })
  .refine(
    (v) => {
      const seen = new Set(v.items.map((item) => `${item.productId}:${item.entitlementType}`));
      return seen.size === v.items.length;
    },
    { message: "Cart contains duplicate items" },
  );

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const razorpayVerifySchema = z.object({
  razorpayOrderId: z.string().min(1).max(100),
  razorpayPaymentId: z.string().min(1).max(100),
  razorpaySignature: z.string().min(1).max(128),
});

export type RazorpayVerifyInput = z.infer<typeof razorpayVerifySchema>;
