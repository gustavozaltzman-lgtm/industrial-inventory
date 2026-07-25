import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Espejo local (SQLite, offline-first) de inventory_scan_events. El
 * dispositivo escribe acá primero con syncStatus = 'pending_sync' y el
 * SyncManager reenvía en batches al backend cuando hay conectividad
 * (ADR-001 §4).
 */
export const inventoryScanEventsLocal = sqliteTable("inventory_scan_events_local", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  warehouseId: text("warehouse_id").notNull(),
  locationId: text("location_id"),
  skuId: text("sku_id").notNull(),
  eventType: text("event_type").notNull(),
  quantity: real("quantity").notNull(),
  captureSource: text("capture_source").notNull(),
  deviceId: text("device_id"),
  operatorId: text("operator_id"),
  imageRef: text("image_ref"),
  metadataJson: text("metadata_json"),
  capturedAt: text("captured_at").notNull(),
  recordedAt: text("recorded_at"),
  syncStatus: text("sync_status").notNull().default("pending_sync"),
  adjustsEventId: text("adjusts_event_id"),
  syncAttempts: integer("sync_attempts").notNull().default(0),
});
