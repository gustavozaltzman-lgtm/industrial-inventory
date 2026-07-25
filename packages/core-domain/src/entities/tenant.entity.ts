import { z } from "zod";
import { entityIdSchema, isoTimestampSchema } from "../schemas/common.schema.js";

export const tenantSchema = z.object({
  id: entityIdSchema,
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  isActive: z.boolean().default(true),
  createdAt: isoTimestampSchema,
});

export type Tenant = z.infer<typeof tenantSchema>;
