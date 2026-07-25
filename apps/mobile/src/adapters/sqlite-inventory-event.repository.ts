import { and, eq, inArray } from "drizzle-orm";
import type { InventoryEventRepository, InventoryScanEvent } from "@indinv/core-domain";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "../db/schema.js";

type LocalRow = typeof schema.inventoryScanEventsLocal.$inferSelect;

function toDomainEvent(row: LocalRow): InventoryScanEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    correlationId: row.correlationId,
    warehouseId: row.warehouseId,
    locationId: row.locationId ?? undefined,
    skuId: row.skuId,
    eventType: row.eventType as InventoryScanEvent["eventType"],
    quantity: row.quantity,
    captureSource: row.captureSource as InventoryScanEvent["captureSource"],
    deviceId: row.deviceId ?? undefined,
    operatorId: row.operatorId ?? undefined,
    imageRef: row.imageRef ?? undefined,
    metadata: row.metadataJson ? JSON.parse(row.metadataJson) : undefined,
    capturedAt: row.capturedAt,
    recordedAt: row.recordedAt ?? undefined,
    syncStatus: row.syncStatus as InventoryScanEvent["syncStatus"],
    adjustsEventId: row.adjustsEventId ?? undefined,
  };
}

function toRow(event: InventoryScanEvent): typeof schema.inventoryScanEventsLocal.$inferInsert {
  return {
    id: event.id,
    tenantId: event.tenantId,
    correlationId: event.correlationId,
    warehouseId: event.warehouseId,
    locationId: event.locationId ?? null,
    skuId: event.skuId,
    eventType: event.eventType,
    quantity: event.quantity,
    captureSource: event.captureSource,
    deviceId: event.deviceId ?? null,
    operatorId: event.operatorId ?? null,
    imageRef: event.imageRef ?? null,
    metadataJson: event.metadata ? JSON.stringify(event.metadata) : null,
    capturedAt: event.capturedAt,
    recordedAt: event.recordedAt ?? null,
    syncStatus: event.syncStatus,
    adjustsEventId: event.adjustsEventId ?? null,
  };
}

/** Adaptador de persistencia local (SQLite en dispositivo). */
export class SqliteInventoryEventRepository implements InventoryEventRepository {
  constructor(private readonly db: ExpoSQLiteDatabase<typeof schema>) {}

  async append(event: InventoryScanEvent): Promise<void> {
    await this.db.insert(schema.inventoryScanEventsLocal).values(toRow(event));
  }

  async appendBatch(events: InventoryScanEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.db.insert(schema.inventoryScanEventsLocal).values(events.map(toRow));
  }

  async findExistingIds(tenantId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .select({ id: schema.inventoryScanEventsLocal.id })
      .from(schema.inventoryScanEventsLocal)
      .where(
        and(
          eq(schema.inventoryScanEventsLocal.tenantId, tenantId),
          inArray(schema.inventoryScanEventsLocal.id, ids),
        ),
      );
    return new Set(rows.map((row) => row.id));
  }

  async findById(tenantId: string, id: string): Promise<InventoryScanEvent | null> {
    const rows = await this.db
      .select()
      .from(schema.inventoryScanEventsLocal)
      .where(
        and(
          eq(schema.inventoryScanEventsLocal.tenantId, tenantId),
          eq(schema.inventoryScanEventsLocal.id, id),
        ),
      )
      .limit(1);
    return rows[0] ? toDomainEvent(rows[0]) : null;
  }

  async findByCorrelationId(
    tenantId: string,
    correlationId: string,
  ): Promise<InventoryScanEvent[]> {
    const rows = await this.db
      .select()
      .from(schema.inventoryScanEventsLocal)
      .where(
        and(
          eq(schema.inventoryScanEventsLocal.tenantId, tenantId),
          eq(schema.inventoryScanEventsLocal.correlationId, correlationId),
        ),
      );
    return rows.map(toDomainEvent);
  }

  async findPendingSync(tenantId: string): Promise<InventoryScanEvent[]> {
    const rows = await this.db
      .select()
      .from(schema.inventoryScanEventsLocal)
      .where(
        and(
          eq(schema.inventoryScanEventsLocal.tenantId, tenantId),
          eq(schema.inventoryScanEventsLocal.syncStatus, "pending_sync"),
        ),
      );
    return rows.map(toDomainEvent);
  }

  async listByWarehouse(tenantId: string, warehouseId: string): Promise<InventoryScanEvent[]> {
    const rows = await this.db
      .select()
      .from(schema.inventoryScanEventsLocal)
      .where(
        and(
          eq(schema.inventoryScanEventsLocal.tenantId, tenantId),
          eq(schema.inventoryScanEventsLocal.warehouseId, warehouseId),
        ),
      );
    return rows.map(toDomainEvent);
  }

  async markSynced(id: string, recordedAt: string): Promise<void> {
    await this.db
      .update(schema.inventoryScanEventsLocal)
      .set({ syncStatus: "synced", recordedAt })
      .where(eq(schema.inventoryScanEventsLocal.id, id));
  }

  async markSyncFailed(id: string): Promise<void> {
    await this.db
      .update(schema.inventoryScanEventsLocal)
      .set({
        syncStatus: "sync_failed",
        syncAttempts: (await this.getAttempts(id)) + 1,
      })
      .where(eq(schema.inventoryScanEventsLocal.id, id));
  }

  private async getAttempts(id: string): Promise<number> {
    const rows = await this.db
      .select({ syncAttempts: schema.inventoryScanEventsLocal.syncAttempts })
      .from(schema.inventoryScanEventsLocal)
      .where(eq(schema.inventoryScanEventsLocal.id, id))
      .limit(1);
    return rows[0]?.syncAttempts ?? 0;
  }
}
