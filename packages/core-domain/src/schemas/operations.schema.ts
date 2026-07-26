import { z } from "zod";
import { entityIdSchema, isoTimestampSchema, tenantIdSchema } from "./common.schema.js";
import { captureSourceSchema } from "./inventory-scan-event.schema.js";
import { networkKindSchema } from "./telemetry.schema.js";

/**
 * KPIs del Centro de Operaciones. Cada campo declara explícitamente si está
 * respaldado por datos persistidos o si todavía no hay fuente: preferimos un
 * `null` honesto a un cero que el operador leería como "todo bien".
 */
export const operationsKpisSchema = z.object({
  windowMinutes: z.number().int().positive(),
  generatedAt: isoTimestampSchema,

  /** Eventos ingeridos por minuto en la ventana. */
  throughputPerMinute: z.number().nonnegative(),
  /** Tiempo medio entre lecturas consecutivas, en segundos. */
  avgSecondsBetweenReads: z.number().nonnegative().nullable(),
  /** capturedAt -> recordedAt: cuánto tardó el evento en llegar al servidor. */
  avgIngestLatencyMs: z.number().nonnegative().nullable(),

  totalEvents: z.number().int().nonnegative(),
  pendingSyncEvents: z.number().int().nonnegative(),
  failedSyncEvents: z.number().int().nonnegative(),
  /** Rechazados por la ingesta idempotente (mismo id reenviado). */
  duplicateEventsRejected: z.number().int().nonnegative(),

  /** Tasa de error por familia de motor de captura, 0..1. */
  barcodeErrorRate: z.number().min(0).max(1).nullable(),
  ocrErrorRate: z.number().min(0).max(1).nullable(),

  eventsByCaptureSource: z.record(captureSourceSchema, z.number().int().nonnegative()),
});
export type OperationsKpis = z.infer<typeof operationsKpisSchema>;

export const deviceHealthSchema = z.enum(["online", "degraded", "offline"]);
export type DeviceHealth = z.infer<typeof deviceHealthSchema>;

export const deviceSnapshotSchema = z.object({
  deviceId: z.string().min(1),
  tenantId: tenantIdSchema,
  label: z.string().min(1).nullable(),
  health: deviceHealthSchema,
  batteryLevel: z.number().min(0).max(1).nullable(),
  isCharging: z.boolean().nullable(),
  network: networkKindSchema,
  pendingSyncCount: z.number().int().nonnegative(),
  lastSeenAt: isoTimestampSchema.nullable(),
  lastSequenceNumber: z.number().int().nonnegative().nullable(),
});
export type DeviceSnapshot = z.infer<typeof deviceSnapshotSchema>;

export const reconciliationRowSchema = z.object({
  skuId: entityIdSchema,
  sku: z.string().min(1),
  description: z.string().min(1),
  locationCode: z.string().min(1).nullable(),
  /** Stock esperado por el sistema. Null si el tenant no cargó stock teórico. */
  theoreticalQuantity: z.number().nullable(),
  /** Suma de los eventos contados en la toma. */
  countedQuantity: z.number(),
  /** countedQuantity - theoreticalQuantity; null si no hay teórico. */
  variance: z.number().nullable(),
  lastCountedAt: isoTimestampSchema.nullable(),
});
export type ReconciliationRow = z.infer<typeof reconciliationRowSchema>;
