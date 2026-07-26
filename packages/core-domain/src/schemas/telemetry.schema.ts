import { z } from "zod";
import { entityIdSchema, isoTimestampSchema, tenantIdSchema } from "./common.schema.js";
import { inventoryScanEventSchema } from "./inventory-scan-event.schema.js";

/**
 * Metadatos de trazabilidad que acompañan a TODO evento de telemetría.
 * Son los mismos campos que el backend adjunta a cada log estructurado
 * (ver tenant-context.plugin.ts), de modo que un evento visto en el
 * Operations Center se puede correlacionar con su traza en el servidor.
 */
export const traceContextSchema = z.object({
  tenantId: tenantIdSchema,
  correlationId: z.string().min(1),
  traceId: z.string().min(1),
  requestId: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
  /** Id generado en el dispositivo; coincide con InventoryScanEvent.id. */
  clientEventId: entityIdSchema.optional(),
});
export type TraceContext = z.infer<typeof traceContextSchema>;

export const networkKindSchema = z.enum(["wifi", "cellular", "ethernet", "vpn", "none", "unknown"]);
export type NetworkKind = z.infer<typeof networkKindSchema>;

/** Canal SSE: un solo stream multiplexa los cuatro tipos de evento. */
export const telemetryEventSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("scan_event"),
    emittedAt: isoTimestampSchema,
    trace: traceContextSchema,
    payload: inventoryScanEventSchema,
  }),
  z.object({
    channel: z.literal("heartbeat"),
    emittedAt: isoTimestampSchema,
    trace: traceContextSchema,
    payload: z.object({
      deviceId: z.string().min(1),
      batteryLevel: z.number().min(0).max(1),
      isCharging: z.boolean(),
      network: networkKindSchema,
      pendingSyncCount: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    channel: z.literal("device_alert"),
    emittedAt: isoTimestampSchema,
    trace: traceContextSchema,
    payload: z.object({
      deviceId: z.string().min(1),
      severity: z.enum(["info", "warning", "critical"]),
      code: z.string().min(1),
      message: z.string().min(1),
    }),
  }),
  z.object({
    channel: z.literal("sync_error"),
    emittedAt: isoTimestampSchema,
    trace: traceContextSchema,
    payload: z.object({
      deviceId: z.string().min(1).optional(),
      failedEventIds: z.array(entityIdSchema),
      reason: z.string().min(1),
      attempt: z.number().int().nonnegative(),
    }),
  }),
]);

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
export type TelemetryChannel = TelemetryEvent["channel"];
