import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createStockAdjustmentEvent,
  createStockReadEvent,
  markSynced,
  markSyncFailed,
} from "../events/inventory-scan-event.js";
import { RecordScanUseCase } from "../use-cases/record-scan.use-case.js";
import { AdjustStockUseCase, OriginalEventNotFoundError } from "../use-cases/adjust-stock.use-case.js";
import { InventoryEventRepository } from "../ports/inventory-event-repository.port.js";
import { InventoryScanEvent } from "../schemas/inventory-scan-event.schema.js";

class InMemoryInventoryEventRepository implements InventoryEventRepository {
  private events: InventoryScanEvent[] = [];

  async append(event: InventoryScanEvent): Promise<void> {
    this.events.push(event);
  }

  async appendBatch(events: InventoryScanEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async findExistingIds(tenantId: string, ids: string[]) {
    return new Set(
      this.events.filter((e) => e.tenantId === tenantId && ids.includes(e.id)).map((e) => e.id),
    );
  }

  async findById(tenantId: string, id: string) {
    return this.events.find((e) => e.tenantId === tenantId && e.id === id) ?? null;
  }

  async findByCorrelationId(tenantId: string, correlationId: string) {
    return this.events.filter((e) => e.tenantId === tenantId && e.correlationId === correlationId);
  }

  async findPendingSync(tenantId: string) {
    return this.events.filter((e) => e.tenantId === tenantId && e.syncStatus === "pending_sync");
  }

  async listByWarehouse(tenantId: string, warehouseId: string) {
    return this.events.filter((e) => e.tenantId === tenantId && e.warehouseId === warehouseId);
  }
}

const tenantId = randomUUID();
const warehouseId = randomUUID();
const skuId = randomUUID();

describe("InventoryScanEvent", () => {
  it("is immutable once created", () => {
    const event = createStockReadEvent({
      tenantId,
      warehouseId,
      skuId,
      quantity: 10,
      captureSource: "ML_KIT_MOBILE",
      capturedAt: new Date().toISOString(),
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(() => {
      (event as { quantity: number }).quantity = 999;
    }).toThrow();
  });

  it("links an adjustment to the original event via correlationId and adjustsEventId", () => {
    const original = createStockReadEvent({
      tenantId,
      warehouseId,
      skuId,
      quantity: 10,
      captureSource: "ZEBRA_SCANNER",
      capturedAt: new Date().toISOString(),
    });

    const adjustment = createStockAdjustmentEvent({
      originalEvent: original,
      adjustedQuantity: 8,
      operatorId: randomUUID(),
      capturedAt: new Date().toISOString(),
    });

    expect(adjustment.correlationId).toBe(original.correlationId);
    expect(adjustment.adjustsEventId).toBe(original.id);
    expect(adjustment.eventType).toBe("STOCK_ADJUSTMENT");
  });

  it("transitions to synced with a recordedAt timestamp", () => {
    const event = createStockReadEvent({
      tenantId,
      warehouseId,
      skuId,
      quantity: 1,
      captureSource: "MANUAL",
      capturedAt: new Date().toISOString(),
    });

    const recordedAt = new Date().toISOString();
    const synced = markSynced(event, recordedAt);

    expect(synced.syncStatus).toBe("synced");
    expect(synced.recordedAt).toBe(recordedAt);
    expect(Object.isFrozen(synced)).toBe(true);
  });

  it("transitions to sync_failed", () => {
    const event = createStockReadEvent({
      tenantId,
      warehouseId,
      skuId,
      quantity: 1,
      captureSource: "MANUAL",
      capturedAt: new Date().toISOString(),
    });

    const failed = markSyncFailed(event);

    expect(failed.syncStatus).toBe("sync_failed");
  });
});

describe("RecordScanUseCase", () => {
  it("persists a new stock read event", async () => {
    const repository = new InMemoryInventoryEventRepository();
    const useCase = new RecordScanUseCase(repository);

    const event = await useCase.execute({
      tenantId,
      warehouseId,
      skuId,
      quantity: 5,
      captureSource: "COGNEX_SOCKET",
      capturedAt: new Date().toISOString(),
    });

    const pending = await repository.findPendingSync(tenantId);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(event.id);
  });

  it("persists a batch of stock read events", async () => {
    const repository = new InMemoryInventoryEventRepository();
    const useCase = new RecordScanUseCase(repository);

    const events = await useCase.executeBatch([
      {
        tenantId,
        warehouseId,
        skuId,
        quantity: 1,
        captureSource: "AMR_ROBOT",
        capturedAt: new Date().toISOString(),
      },
      {
        tenantId,
        warehouseId,
        skuId,
        quantity: 2,
        captureSource: "IP_CAMERA",
        capturedAt: new Date().toISOString(),
      },
    ]);

    expect(events).toHaveLength(2);
    const pending = await repository.findPendingSync(tenantId);
    expect(pending).toHaveLength(2);
  });
});

describe("AdjustStockUseCase", () => {
  it("throws when the original event does not exist", async () => {
    const repository = new InMemoryInventoryEventRepository();
    const useCase = new AdjustStockUseCase(repository);

    await expect(
      useCase.execute({
        tenantId,
        originalEventId: randomUUID(),
        adjustedQuantity: 1,
        operatorId: randomUUID(),
        capturedAt: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(OriginalEventNotFoundError);
  });

  it("creates and persists an adjustment referencing the original event", async () => {
    const repository = new InMemoryInventoryEventRepository();
    const recordUseCase = new RecordScanUseCase(repository);
    const adjustUseCase = new AdjustStockUseCase(repository);

    const original = await recordUseCase.execute({
      tenantId,
      warehouseId,
      skuId,
      quantity: 20,
      captureSource: "MANUAL",
      capturedAt: new Date().toISOString(),
    });

    const adjustment = await adjustUseCase.execute({
      tenantId,
      originalEventId: original.id,
      adjustedQuantity: 18,
      operatorId: randomUUID(),
      capturedAt: new Date().toISOString(),
    });

    expect(adjustment.adjustsEventId).toBe(original.id);
    const history = await repository.findByCorrelationId(tenantId, original.correlationId);
    expect(history).toHaveLength(2);
  });
});
