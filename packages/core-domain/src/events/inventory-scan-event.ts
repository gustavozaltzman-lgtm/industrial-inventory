import {
  InventoryScanEvent,
  inventoryScanEventSchema,
  CaptureSource,
} from "../schemas/inventory-scan-event.schema.js";
import { EntityId, TenantId } from "../schemas/common.schema.js";

/**
 * Usamos el Web Crypto global (disponible en Node >=19, browsers y en RN vía
 * el polyfill de expo-crypto) en lugar de "node:crypto" para que este paquete
 * siga siendo runtime-agnostic y utilizable desde apps/mobile (ADR-001 §1).
 */
function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * InventoryScanEvent es inmutable: no existe "update". Una corrección de
 * stock siempre crea un nuevo evento STOCK_ADJUSTMENT que referencia al
 * original vía adjustsEventId, preservando la trazabilidad histórica (ADR-001 §3).
 */

export interface NewStockReadInput {
  tenantId: TenantId;
  warehouseId: EntityId;
  skuId: EntityId;
  quantity: number;
  captureSource: CaptureSource;
  capturedAt: string;
  correlationId?: string;
  locationId?: EntityId;
  deviceId?: string;
  sequenceNumber?: number;
  operatorId?: EntityId;
  imageRef?: string;
  metadata?: Record<string, unknown>;
}

export function createStockReadEvent(input: NewStockReadInput): InventoryScanEvent {
  const event: InventoryScanEvent = {
    id: randomUUID(),
    correlationId: input.correlationId ?? randomUUID(),
    tenantId: input.tenantId,
    warehouseId: input.warehouseId,
    locationId: input.locationId,
    skuId: input.skuId,
    eventType: "STOCK_READ",
    quantity: input.quantity,
    captureSource: input.captureSource,
    deviceId: input.deviceId,
    sequenceNumber: input.sequenceNumber,
    operatorId: input.operatorId,
    imageRef: input.imageRef,
    metadata: input.metadata,
    capturedAt: input.capturedAt,
    syncStatus: "pending_sync",
  };

  return Object.freeze(inventoryScanEventSchema.parse(event));
}

export interface StockAdjustmentInput {
  originalEvent: InventoryScanEvent;
  adjustedQuantity: number;
  operatorId: EntityId;
  capturedAt: string;
  reasonMetadata?: Record<string, unknown>;
}

export function createStockAdjustmentEvent(
  input: StockAdjustmentInput,
): InventoryScanEvent {
  const { originalEvent } = input;

  const event: InventoryScanEvent = {
    id: randomUUID(),
    correlationId: originalEvent.correlationId,
    tenantId: originalEvent.tenantId,
    warehouseId: originalEvent.warehouseId,
    locationId: originalEvent.locationId,
    skuId: originalEvent.skuId,
    eventType: "STOCK_ADJUSTMENT",
    quantity: input.adjustedQuantity,
    captureSource: "MANUAL",
    operatorId: input.operatorId,
    metadata: input.reasonMetadata,
    capturedAt: input.capturedAt,
    syncStatus: "pending_sync",
    adjustsEventId: originalEvent.id,
  };

  return Object.freeze(inventoryScanEventSchema.parse(event));
}

export function markSynced(event: InventoryScanEvent, recordedAt: string): InventoryScanEvent {
  return Object.freeze(
    inventoryScanEventSchema.parse({ ...event, syncStatus: "synced", recordedAt }),
  );
}

export function markSyncFailed(event: InventoryScanEvent): InventoryScanEvent {
  return Object.freeze(inventoryScanEventSchema.parse({ ...event, syncStatus: "sync_failed" }));
}
