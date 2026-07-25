import { z } from "zod";
import {
  correlationIdSchema,
  entityIdSchema,
  isoTimestampSchema,
  tenantIdSchema,
} from "./common.schema.js";

/**
 * Fuente de captura del evento. Nuevos dispositivos se agregan aquí sin tocar
 * la lógica de casos de uso (ver VisionEngineAdapter / ScanIngestPayload ports).
 */
export const captureSourceSchema = z.enum([
  "ML_KIT_MOBILE",
  "COGNEX_SOCKET",
  "ZEBRA_SCANNER",
  "IP_CAMERA",
  "AMR_ROBOT",
  "MANUAL",
]);
export type CaptureSource = z.infer<typeof captureSourceSchema>;

export const scanEventTypeSchema = z.enum([
  "STOCK_READ",
  "STOCK_ADJUSTMENT",
  "CYCLE_COUNT",
]);
export type ScanEventType = z.infer<typeof scanEventTypeSchema>;

export const syncStatusSchema = z.enum(["pending_sync", "synced", "sync_failed"]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const inventoryScanEventSchema = z.object({
  /**
   * Generado en el dispositivo al momento del escaneo. Es la clave de
   * idempotencia: el backend deduplica por (tenantId, id) en la ingesta por
   * lote, de modo que reintentar un lote tras una caída de red no duplica.
   */
  id: entityIdSchema,
  tenantId: tenantIdSchema,
  correlationId: correlationIdSchema,
  warehouseId: entityIdSchema,
  locationId: entityIdSchema.optional(),
  skuId: entityIdSchema,
  eventType: scanEventTypeSchema,
  quantity: z.number().finite(),
  captureSource: captureSourceSchema,
  deviceId: z.string().min(1).optional(),
  /**
   * Contador monotónico por dispositivo. No participa de la deduplicación
   * (eso lo hace `id`), pero permite detectar huecos en la secuencia de un
   * equipo — es decir, escaneos que nunca llegaron a sincronizarse.
   */
  sequenceNumber: z.number().int().nonnegative().optional(),
  operatorId: entityIdSchema.optional(),
  imageRef: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  capturedAt: isoTimestampSchema,
  recordedAt: isoTimestampSchema.optional(),
  syncStatus: syncStatusSchema,
  /** Presente únicamente en STOCK_ADJUSTMENT: id del evento que se corrige. */
  adjustsEventId: entityIdSchema.optional(),
});

export type InventoryScanEvent = z.infer<typeof inventoryScanEventSchema>;
