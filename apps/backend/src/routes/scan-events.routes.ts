import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AdjustStockUseCase,
  captureSourceSchema,
  inventoryScanEventSchema,
  markSynced,
  OriginalEventNotFoundError,
  RecordScanUseCase,
  type InventoryEventRepository,
} from "@indinv/core-domain";
import { PostgresInventoryEventRepository } from "../adapters/persistence/inventory-event.repository.js";
import { db } from "../adapters/persistence/db.js";

const createScanEventBodySchema = z.object({
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  skuId: z.string().uuid(),
  quantity: z.number().finite(),
  captureSource: captureSourceSchema,
  capturedAt: z.string().datetime({ offset: true }),
  deviceId: z.string().optional(),
  operatorId: z.string().uuid().optional(),
  imageRef: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const syncBatchBodySchema = z.object({
  events: z.array(inventoryScanEventSchema).min(1).max(500),
});

const adjustStockBodySchema = z.object({
  originalEventId: z.string().uuid(),
  adjustedQuantity: z.number().finite(),
  operatorId: z.string().uuid(),
  capturedAt: z.string().datetime({ offset: true }),
  reasonMetadata: z.record(z.string(), z.unknown()).optional(),
});

export interface ScanEventsRoutesOptions {
  repository?: InventoryEventRepository;
}

export async function scanEventsRoutes(
  app: FastifyInstance,
  options: ScanEventsRoutesOptions = {},
) {
  const repository = options.repository ?? new PostgresInventoryEventRepository(db);
  const recordScan = new RecordScanUseCase(repository);
  const adjustStock = new AdjustStockUseCase(repository);

  app.post("/scan-events", async (request, reply) => {
    const body = createScanEventBodySchema.parse(request.body);
    const event = await recordScan.execute({ ...body, tenantId: request.tenantId });
    return reply.code(201).send(event);
  });

  app.post("/scan-events/batch", async (request, reply) => {
    const body = syncBatchBodySchema.parse(request.body);
    const recordedAt = new Date().toISOString();
    const events = body.events
      .filter((event) => event.tenantId === request.tenantId)
      .map((event) => markSynced(event, recordedAt));
    await repository.appendBatch(events);
    return reply.code(201).send({ accepted: events.length });
  });

  app.post("/scan-events/adjustments", async (request, reply) => {
    const body = adjustStockBodySchema.parse(request.body);
    try {
      const event = await adjustStock.execute({ ...body, tenantId: request.tenantId });
      return reply.code(201).send(event);
    } catch (error) {
      if (error instanceof OriginalEventNotFoundError) {
        return reply.notFound(error.message);
      }
      throw error;
    }
  });

  app.get("/warehouses/:warehouseId/scan-events", async (request) => {
    const { warehouseId } = request.params as { warehouseId: string };
    return repository.listByWarehouse(request.tenantId, warehouseId);
  });
}
