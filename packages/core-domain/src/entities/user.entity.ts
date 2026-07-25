import { z } from "zod";
import { entityIdSchema, isoTimestampSchema, tenantIdSchema } from "../schemas/common.schema.js";

export const userRoleSchema = z.enum(["ADMIN", "SUPERVISOR", "OPERATOR"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userSchema = z.object({
  id: entityIdSchema,
  tenantId: tenantIdSchema,
  email: z.string().email(),
  displayName: z.string().min(1),
  role: userRoleSchema,
  isActive: z.boolean().default(true),
  createdAt: isoTimestampSchema,
});

export type User = z.infer<typeof userSchema>;
