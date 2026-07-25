import { z } from "zod";
import { entityIdSchema, isoTimestampSchema, tenantIdSchema } from "../schemas/common.schema.js";

export const warehouseSchema = z.object({
  id: entityIdSchema,
  tenantId: tenantIdSchema,
  name: z.string().min(1),
  code: z.string().min(1),
  createdAt: isoTimestampSchema,
});

export type Warehouse = z.infer<typeof warehouseSchema>;

export const locationSchema = z.object({
  id: entityIdSchema,
  tenantId: tenantIdSchema,
  warehouseId: entityIdSchema,
  code: z.string().min(1),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  level: z.string().optional(),
  /** Profundidad útil del rack en cm, usada para validar capacidad de slotting. */
  depthCm: z.number().positive().optional(),
  createdAt: isoTimestampSchema,
});

export type Location = z.infer<typeof locationSchema>;
