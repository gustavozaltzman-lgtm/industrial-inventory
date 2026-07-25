import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Espejo local (SQLite, offline-first) de inventory_scan_events. El
 * dispositivo escribe acá PRIMERO con syncStatus = 'pending_sync', antes de
 * cualquier intento de red. El BackgroundSyncService los sube en lotes
 * idempotentes cuando hay conectividad (ADR-001 §4).
 *
 * `syncStatus` local tiene un estado extra respecto del dominio: 'syncing'.
 * Es un lock optimista para que dos disparadores concurrentes (volvió la red
 * y el usuario volvió a foreground a la vez) no suban el mismo lote dos veces.
 */
export const inventoryScanEventsLocal = sqliteTable(
  "inventory_scan_events_local",
  {
    /** Clave de idempotencia generada en el dispositivo. */
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
    sequenceNumber: integer("sequence_number"),
    operatorId: text("operator_id"),
    imageRef: text("image_ref"),
    metadataJson: text("metadata_json"),
    capturedAt: text("captured_at").notNull(),
    recordedAt: text("recorded_at"),
    syncStatus: text("sync_status", {
      enum: ["pending_sync", "syncing", "synced", "sync_failed"],
    })
      .notNull()
      .default("pending_sync"),
    adjustsEventId: text("adjusts_event_id"),
    // --- auditoría local, no viaja al backend ---
    createdOfflineAt: text("created_offline_at").notNull(),
    syncAttempts: integer("sync_attempts").notNull().default(0),
    lastSyncError: text("last_sync_error"),
    /** epoch ms; el QueueManager no reintenta antes de esta marca (backoff). */
    nextRetryAt: integer("next_retry_at"),
  },
  (table) => [
    index("local_tenant_sync_idx").on(table.tenantId, table.syncStatus),
    index("local_tenant_sequence_idx").on(table.tenantId, table.sequenceNumber),
  ],
);

/** Contador monotónico por dispositivo, persistido para sobrevivir reinicios. */
export const deviceSequence = sqliteTable("device_sequence", {
  deviceId: text("device_id").primaryKey(),
  lastSequence: integer("last_sequence").notNull().default(0),
});
