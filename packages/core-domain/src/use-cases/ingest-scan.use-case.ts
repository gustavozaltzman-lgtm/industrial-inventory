import { InventoryEventRepository } from "../ports/inventory-event-repository.port.js";
import {
  InventoryScanEvent,
  inventoryScanEventSchema,
} from "../schemas/inventory-scan-event.schema.js";
import { TenantId } from "../schemas/common.schema.js";

/** Envoltorio de ingesta por lote (offline batch ingest) desde clientes desconectados. */
export const scanIngestBatchSchema = inventoryScanEventSchema.array().min(1).max(500);
export type ScanIngestBatch = InventoryScanEvent[];

export interface IngestScanResult {
  inserted: InventoryScanEvent[];
  duplicateCount: number;
}

export class TenantMismatchError extends Error {
  constructor(eventId: string, actualTenantId: string, expectedTenantId: string) {
    super(`Event ${eventId} belongs to tenant ${actualTenantId}, expected ${expectedTenantId}`);
    this.name = "TenantMismatchError";
  }
}

/**
 * Ingesta idempotente de lotes de InventoryScanEvent ya generados por un
 * cliente offline (cada evento trae su `id` propio, asignado en el
 * dispositivo al momento del escaneo — ver createStockReadEvent). Reintentar
 * el mismo lote (ej. tras una caída de red a mitad de sync) no debe duplicar
 * eventos: se descartan los ids que el repositorio ya tiene persistidos.
 */
export class IngestScanUseCase {
  constructor(private readonly repository: InventoryEventRepository) {}

  async execute(tenantId: TenantId, rawEvents: unknown): Promise<IngestScanResult> {
    const events = scanIngestBatchSchema.parse(rawEvents);

    const mismatchedTenant = events.find((event) => event.tenantId !== tenantId);
    if (mismatchedTenant) {
      throw new TenantMismatchError(mismatchedTenant.id, mismatchedTenant.tenantId, tenantId);
    }

    const existingIds = await this.repository.findExistingIds(
      tenantId,
      events.map((event) => event.id),
    );

    const newEvents = events.filter((event) => !existingIds.has(event.id));

    if (newEvents.length > 0) {
      await this.repository.appendBatch(newEvents);
    }

    return { inserted: newEvents, duplicateCount: events.length - newEvents.length };
  }
}
