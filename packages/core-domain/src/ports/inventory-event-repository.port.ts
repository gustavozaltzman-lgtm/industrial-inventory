import { InventoryScanEvent } from "../schemas/inventory-scan-event.schema.js";
import { EntityId, TenantId } from "../schemas/common.schema.js";

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Puerto de persistencia. Los adaptadores concretos (Postgres/Neon en
 * apps/backend, SQLite en apps/mobile) implementan esta interfaz sin que el
 * dominio conozca el motor de almacenamiento subyacente.
 */
export interface InventoryEventRepository {
  append(event: InventoryScanEvent): Promise<void>;
  appendBatch(events: InventoryScanEvent[]): Promise<void>;
  /** IDs de `ids` que ya existen para ese tenant — usado para deduplicar ingesta idempotente. */
  findExistingIds(tenantId: TenantId, ids: EntityId[]): Promise<Set<string>>;
  findById(tenantId: TenantId, id: EntityId): Promise<InventoryScanEvent | null>;
  findByCorrelationId(
    tenantId: TenantId,
    correlationId: string,
  ): Promise<InventoryScanEvent[]>;
  findPendingSync(tenantId: TenantId): Promise<InventoryScanEvent[]>;
  listByWarehouse(
    tenantId: TenantId,
    warehouseId: EntityId,
    range?: DateRange,
  ): Promise<InventoryScanEvent[]>;
}
