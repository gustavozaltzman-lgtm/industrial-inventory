import { z } from "zod";
import { entityIdSchema, isoTimestampSchema, tenantIdSchema } from "../schemas/common.schema.js";

/**
 * Dimensiones físicas del producto en su unidad de empaque base. Se usan
 * para validar capacidad de racks/ubicaciones y para cálculos de slotting.
 */
export const productDimensionsSchema = z.object({
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
  depthCm: z.number().positive(),
  weightKg: z.number().positive(),
});

export type ProductDimensions = z.infer<typeof productDimensionsSchema>;

export const productSchema = z.object({
  id: entityIdSchema,
  tenantId: tenantIdSchema,
  sku: z.string().min(1),
  barcode: z.string().min(1).optional(),
  description: z.string().min(1),
  unitOfMeasure: z.enum(["EA", "BOX", "PALLET", "KG", "L"]),
  dimensions: productDimensionsSchema,
  createdAt: isoTimestampSchema,
});

export type Product = z.infer<typeof productSchema>;
