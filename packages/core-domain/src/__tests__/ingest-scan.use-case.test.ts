import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createStockReadEvent } from "../events/inventory-scan-event.js";
import { IngestScanUseCase } from "../use-cases/ingest-scan.use-case.js";
import type { InventoryEventRepository } from "../ports/inventory-event-repository.port.js";

const tenantId = randomUUID();
const warehouseId = randomUUID();
const skuId = randomUUID();

function buildEvent() {
  return createStockReadEvent({
    tenantId,
    warehouseId,
    skuId,
    quantity: 1,
    captureSource: "MANUAL",
    capturedAt: new Date().toISOString(),
  });
}

function buildRepositoryMock(existingIds: Set<string> = new Set()): InventoryEventRepository {
  return {
    append: vi.fn(),
    appendBatch: vi.fn(),
    findExistingIds: vi.fn().mockResolvedValue(existingIds),
    findById: vi.fn(),
    findByCorrelationId: vi.fn(),
    findPendingSync: vi.fn(),
    listByWarehouse: vi.fn(),
  };
}

describe("IngestScanUseCase", () => {
  it("processes and persists a valid batch", async () => {
    const repository = buildRepositoryMock();
    const useCase = new IngestScanUseCase(repository);
    const events = [buildEvent(), buildEvent()];

    const result = await useCase.execute(tenantId, events);

    expect(result.inserted).toHaveLength(2);
    expect(result.duplicateCount).toBe(0);
    expect(repository.appendBatch).toHaveBeenCalledWith(events);
  });

  it("idempotently skips scans that were already ingested", async () => {
    const events = [buildEvent(), buildEvent()];
    const repository = buildRepositoryMock(new Set([events[0]!.id]));
    const useCase = new IngestScanUseCase(repository);

    const result = await useCase.execute(tenantId, events);

    expect(result.inserted).toEqual([events[1]]);
    expect(result.duplicateCount).toBe(1);
    expect(repository.appendBatch).toHaveBeenCalledWith([events[1]]);
  });

  it("does not call appendBatch when the whole batch is already ingested", async () => {
    const events = [buildEvent()];
    const repository = buildRepositoryMock(new Set([events[0]!.id]));
    const useCase = new IngestScanUseCase(repository);

    const result = await useCase.execute(tenantId, events);

    expect(result.inserted).toHaveLength(0);
    expect(result.duplicateCount).toBe(1);
    expect(repository.appendBatch).not.toHaveBeenCalled();
  });

  it("rejects events that belong to a different tenant", async () => {
    const repository = buildRepositoryMock();
    const useCase = new IngestScanUseCase(repository);
    const events = [buildEvent()];

    await expect(useCase.execute(randomUUID(), events)).rejects.toThrow(/expected/);
  });

  it("rejects malformed payloads", async () => {
    const repository = buildRepositoryMock();
    const useCase = new IngestScanUseCase(repository);

    await expect(useCase.execute(tenantId, [{ not: "an event" }])).rejects.toThrow();
  });
});
