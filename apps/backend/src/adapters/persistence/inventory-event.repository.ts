import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type {
  DateRange,
  InventoryEventRepository,
  InventoryScanEvent,
} from "@indinv/core-domain";
import { Db, withTenantContext } from "./db.js";
import { inventoryScanEvents } from "./schema.js";

function toDomainEvent(row: typeof inventoryScanEvents.$inferSelect): InventoryScanEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    correlationId: row.correlationId,
    warehouseId: row.warehouseId,
    locationId: row.locationId ?? undefined,
    skuId: row.skuId,
    eventType: row.eventType,
    quantity: row.quantity,
    captureSource: row.captureSource,
    deviceId: row.deviceId ?? undefined,
    operatorId: row.operatorId ?? undefined,
    imageRef: row.imageRef ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    capturedAt: row.capturedAt.toISOString(),
    recordedAt: row.recordedAt?.toISOString(),
    syncStatus: row.syncStatus,
    adjustsEventId: row.adjustsEventId ?? undefined,
  };
}

function toRow(event: InventoryScanEvent) {
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
    metadata: event.metadata ?? null,
    capturedAt: new Date(event.capturedAt),
    recordedAt: event.recordedAt ? new Date(event.recordedAt) : new Date(),
    syncStatus: event.syncStatus,
    adjustsEventId: event.adjustsEventId ?? null,
  };
}

/**
 * Adaptador de persistencia Postgres/Neon. Cada operación corre dentro de
 * withTenantContext, que fija `app.tenant_id` para que las políticas RLS
 * (rls.sql) filtren automáticamente por tenant.
 */
export class PostgresInventoryEventRepository implements InventoryEventRepository {
  constructor(private readonly db: Db) {}

  async append(event: InventoryScanEvent): Promise<void> {
    await withTenantContext(event.tenantId, async (tx) => {
      await tx.insert(inventoryScanEvents).values(toRow(event));
    });
  }

  async appendBatch(events: InventoryScanEvent[]): Promise<void> {
    if (events.length === 0) return;
    const tenantId = events[0]!.tenantId;
    await withTenantContext(tenantId, async (tx) => {
      await tx.insert(inventoryScanEvents).values(events.map(toRow));
    });
  }

  async findExistingIds(tenantId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    return withTenantContext(tenantId, async (tx) => {
      const rows = await tx
        .select({ id: inventoryScanEvents.id })
        .from(inventoryScanEvents)
        .where(and(eq(inventoryScanEvents.tenantId, tenantId), inArray(inventoryScanEvents.id, ids)));
      return new Set(rows.map((row) => row.id));
    });
  }

  async findById(tenantId: string, id: string): Promise<InventoryScanEvent | null> {
    return withTenantContext(tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(inventoryScanEvents)
        .where(and(eq(inventoryScanEvents.tenantId, tenantId), eq(inventoryScanEvents.id, id)))
        .limit(1);
      return row ? toDomainEvent(row) : null;
    });
  }

  async findByCorrelationId(
    tenantId: string,
    correlationId: string,
  ): Promise<InventoryScanEvent[]> {
    return withTenantContext(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(inventoryScanEvents)
        .where(
          and(
            eq(inventoryScanEvents.tenantId, tenantId),
            eq(inventoryScanEvents.correlationId, correlationId),
          ),
        )
        .orderBy(asc(inventoryScanEvents.capturedAt));
      return rows.map(toDomainEvent);
    });
  }

  async findPendingSync(tenantId: string): Promise<InventoryScanEvent[]> {
    return withTenantContext(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(inventoryScanEvents)
        .where(
          and(
            eq(inventoryScanEvents.tenantId, tenantId),
            eq(inventoryScanEvents.syncStatus, "pending_sync"),
          ),
        );
      return rows.map(toDomainEvent);
    });
  }

  async listByWarehouse(
    tenantId: string,
    warehouseId: string,
    range?: DateRange,
  ): Promise<InventoryScanEvent[]> {
    return withTenantContext(tenantId, async (tx) => {
      const conditions = [
        eq(inventoryScanEvents.tenantId, tenantId),
        eq(inventoryScanEvents.warehouseId, warehouseId),
      ];
      if (range) {
        conditions.push(gte(inventoryScanEvents.capturedAt, new Date(range.from)));
        conditions.push(lte(inventoryScanEvents.capturedAt, new Date(range.to)));
      }
      const rows = await tx
        .select()
        .from(inventoryScanEvents)
        .where(and(...conditions))
        .orderBy(asc(inventoryScanEvents.capturedAt));
      return rows.map(toDomainEvent);
    });
  }
}
