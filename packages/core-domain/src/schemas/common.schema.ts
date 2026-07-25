import { z } from "zod";

export const tenantIdSchema = z.string().uuid();
export const entityIdSchema = z.string().uuid();
export const correlationIdSchema = z.string().uuid();

export const isoTimestampSchema = z.string().datetime({ offset: true });

export type TenantId = z.infer<typeof tenantIdSchema>;
export type EntityId = z.infer<typeof entityIdSchema>;
export type CorrelationId = z.infer<typeof correlationIdSchema>;
export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;
