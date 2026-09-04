import { z } from "zod";
import { INTERIOR_CATEGORIES } from "./enums";

const nameSchema = z.string().trim().min(1).max(120);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers and hyphens");

const descriptionSchema = z.string().trim().min(1).max(2000);

export const floorPlanDetailsSchema = z
  .object({
    lengthFt: z.number().int().positive(),
    widthFt: z.number().int().positive(),
    floorAreaSqFt: z.number().int().positive(),
    bathrooms: z.number().int().min(0),
    bedrooms: z.number().int().min(0),
    floors: z.number().int().positive(),
    floorPlanPriceCents: z.number().int().positive(),
    elevationPriceCents: z.number().int().positive(),
    bundlePriceCents: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (v) => v.bundlePriceCents == null || v.bundlePriceCents < v.floorPlanPriceCents + v.elevationPriceCents,
    { message: "Bundle price must be lower than the combined individual prices", path: ["bundlePriceCents"] },
  );

export type FloorPlanDetails = z.infer<typeof floorPlanDetailsSchema>;

export const interiorPlanDetailsSchema = z.object({
  category: z.enum(INTERIOR_CATEGORIES),
  workingDrawingPriceCents: z.number().int().positive(),
});

export type InteriorPlanDetails = z.infer<typeof interiorPlanDetailsSchema>;

const productBaseSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
  description: descriptionSchema.optional(),
  published: z.boolean().optional(),
});

export const createFloorPlanProductSchema = productBaseSchema.extend({
  type: z.literal("FLOOR_PLAN"),
  details: floorPlanDetailsSchema,
});

export const createInteriorPlanProductSchema = productBaseSchema.extend({
  type: z.literal("INTERIOR_PLAN"),
  details: interiorPlanDetailsSchema,
});

export const createProductSchema = z.discriminatedUnion("type", [
  createFloorPlanProductSchema,
  createInteriorPlanProductSchema,
]);

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateFloorPlanProductSchema = z.object({
  name: nameSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  published: z.boolean().optional(),
  details: floorPlanDetailsSchema.optional(),
});

export type UpdateFloorPlanProductInput = z.infer<typeof updateFloorPlanProductSchema>;

export const updateInteriorPlanProductSchema = z.object({
  name: nameSchema.optional(),
  slug: slugSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  published: z.boolean().optional(),
  details: interiorPlanDetailsSchema.optional(),
});

export type UpdateInteriorPlanProductInput = z.infer<typeof updateInteriorPlanProductSchema>;

const qSchema = z.string().trim().max(100).optional();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(50).default(20);
const orderSchema = z.enum(["asc", "desc"]).default("desc");

export const floorPlanListQuerySchema = z.object({
  q: qSchema,
  minLengthFt: z.coerce.number().int().positive().optional(),
  maxLengthFt: z.coerce.number().int().positive().optional(),
  minWidthFt: z.coerce.number().int().positive().optional(),
  maxWidthFt: z.coerce.number().int().positive().optional(),
  minAreaSqFt: z.coerce.number().int().positive().optional(),
  maxAreaSqFt: z.coerce.number().int().positive().optional(),
  sort: z.enum(["createdAt", "floorAreaSqFt", "lengthFt", "widthFt"]).default("createdAt"),
  order: orderSchema,
  page: pageSchema,
  limit: limitSchema,
});

export type FloorPlanListQuery = z.infer<typeof floorPlanListQuerySchema>;

export const interiorPlanListQuerySchema = z.object({
  q: qSchema,
  category: z.enum(INTERIOR_CATEGORIES).optional(),
  sort: z.enum(["createdAt", "name"]).default("createdAt"),
  order: orderSchema,
  page: pageSchema,
  limit: limitSchema,
});

export type InteriorPlanListQuery = z.infer<typeof interiorPlanListQuerySchema>;
