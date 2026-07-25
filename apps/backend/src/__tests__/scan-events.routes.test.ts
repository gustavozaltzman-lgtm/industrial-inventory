import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createStockReadEvent,
  type DateRange,
  type InventoryEventRepository,
  type InventoryScanEvent,
} from "@indinv/core-domain";
import { buildApp } from "../app.js";

class InMemoryInventoryEventRepository implements InventoryEventRepository {
  events: InventoryScanEvent[] = [];

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

  async listByWarehouse(tenantId: string, warehouseId: string, _range?: DateRange) {
    return this.events.filter((e) => e.tenantId === tenantId && e.warehouseId === warehouseId);
  }
}

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const warehouseId = randomUUID();
const skuId = randomUUID();

describe("scanEventsRoutes", () => {
  let repository: InMemoryInventoryEventRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    repository = new InMemoryInventoryEventRepository();
    app = buildApp({ repository, logger: false });
  });

  it("rejects requests without x-tenant-id", async () => {
    const response = await app.inject({ method: "GET", url: `/warehouses/${warehouseId}/scan-events` });
    expect(response.statusCode).toBe(400);
  });

  it("creates a scan event and returns it with 201", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/scan-events",
      headers: { "x-tenant-id": tenantId },
      payload: {
        warehouseId,
        skuId,
        quantity: 5,
        captureSource: "MANUAL",
        capturedAt: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.tenantId).toBe(tenantId);
    expect(body.syncStatus).toBe("pending_sync");
    expect(repository.events).toHaveLength(1);
  });

  it("isolates scan events per tenant when listing by warehouse", async () => {
    await app.inject({
      method: "POST",
      url: "/scan-events",
      headers: { "x-tenant-id": tenantId },
      payload: {
        warehouseId,
        skuId,
        quantity: 5,
        captureSource: "MANUAL",
        capturedAt: new Date().toISOString(),
      },
    });
    await app.inject({
      method: "POST",
      url: "/scan-events",
      headers: { "x-tenant-id": otherTenantId },
      payload: {
        warehouseId,
        skuId,
        quantity: 99,
        captureSource: "MANUAL",
        capturedAt: new Date().toISOString(),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/warehouses/${warehouseId}/scan-events`,
      headers: { "x-tenant-id": tenantId },
    });

    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0].tenantId).toBe(tenantId);
  });

  it("creates an adjustment referencing the original event", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/scan-events",
      headers: { "x-tenant-id": tenantId },
      payload: {
        warehouseId,
        skuId,
        quantity: 20,
        captureSource: "MANUAL",
        capturedAt: new Date().toISOString(),
      },
    });
    const originalEventId = created.json().id;

    const response = await app.inject({
      method: "POST",
      url: "/scan-events/adjustments",
      headers: { "x-tenant-id": tenantId },
      payload: {
        originalEventId,
        adjustedQuantity: 18,
        operatorId: randomUUID(),
        capturedAt: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().adjustsEventId).toBe(originalEventId);
  });

  it("returns 404 when adjusting a non-existent event", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/scan-events/adjustments",
      headers: { "x-tenant-id": tenantId },
      payload: {
        originalEventId: randomUUID(),
        adjustedQuantity: 1,
        operatorId: randomUUID(),
        capturedAt: new Date().toISOString(),
      },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("POST /api/v1/scans/batch", () => {
  let repository: InMemoryInventoryEventRepository;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    repository = new InMemoryInventoryEventRepository();
    app = buildApp({ repository, logger: false });
  });

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

  it("ingests a new batch and reports zero duplicates", async () => {
    const events = [buildEvent(), buildEvent()];

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/scans/batch",
      headers: { "x-tenant-id": tenantId },
      payload: { events },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ inserted: 2, duplicates: 0 });
    expect(repository.events).toHaveLength(2);
  });

  it("is idempotent: re-ingesting the same batch skips duplicates", async () => {
    const events = [buildEvent(), buildEvent()];

    await app.inject({
      method: "POST",
      url: "/api/v1/scans/batch",
      headers: { "x-tenant-id": tenantId },
      payload: { events },
    });

    const retry = await app.inject({
      method: "POST",
      url: "/api/v1/scans/batch",
      headers: { "x-tenant-id": tenantId },
      payload: { events },
    });

    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual({ inserted: 0, duplicates: 2 });
    expect(repository.events).toHaveLength(2);
  });

  it("rejects a batch containing events from another tenant", async () => {
    const foreignEvent = createStockReadEvent({
      tenantId: otherTenantId,
      warehouseId,
      skuId,
      quantity: 1,
      captureSource: "MANUAL",
      capturedAt: new Date().toISOString(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/scans/batch",
      headers: { "x-tenant-id": tenantId },
      payload: { events: [foreignEvent] },
    });

    expect(response.statusCode).toBe(400);
  });
});
