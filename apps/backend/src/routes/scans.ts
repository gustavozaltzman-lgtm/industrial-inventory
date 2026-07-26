import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  IngestScanUseCase,
  scanIngestBatchSchema,
  TenantMismatchError,
  type InventoryEventRepository,
} from "@indinv/core-domain";
import { PostgresInventoryEventRepository } from "../adapters/persistence/inventory-event.repository.js";
import { db } from "../adapters/persistence/db.js";
import { telemetryHub, type TelemetryHub } from "../services/telemetry-hub.js";

export interface ScansRoutesOptions {
  repository?: InventoryEventRepository;
  hub?: TelemetryHub;
}

const batchIngestBodySchema = z.object({
  events: scanIngestBatchSchema,
});

const batchIngestResponseSchema = z.object({
  inserted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
});

/**
 * POST /api/v1/scans/batch — ingesta idempotente de lotes de InventoryScanEvent
 * generados por clientes offline. El handler solo valida entrada/salida (Zod);
 * toda la lógica de dedup vive en IngestScanUseCase (core-domain).
 */
export const scansRoutes: FastifyPluginAsyncZod<ScansRoutesOptions> = async (app, options) => {
  const repository = options.repository ?? new PostgresInventoryEventRepository(db);
  const hub = options.hub ?? telemetryHub;
  const ingestScan = new IngestScanUseCase(repository);

  app.post(
    "/scans/batch",
    {
      schema: {
        body: batchIngestBodySchema,
        response: { 201: batchIngestResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        const result = await ingestScan.execute(request.tenantId, request.body.events);

        // Se publica después de persistir: un panel nunca debe ver un evento
        // que todavía podría fallar al escribirse.
        const emittedAt = new Date().toISOString();
        for (const event of result.inserted) {
          hub.publish({
            channel: "scan_event",
            emittedAt,
            trace: {
              tenantId: request.tenantId,
              correlationId: request.correlationId,
              traceId: request.traceId,
              requestId: String(request.id),
              deviceId: event.deviceId,
              clientEventId: event.id,
            },
            payload: event,
          });
        }

        return reply.code(201).send({
          inserted: result.inserted.length,
          duplicates: result.duplicateCount,
        });
      } catch (error) {
        if (error instanceof TenantMismatchError) {
          return reply.badRequest(error.message);
        }
        throw error;
      }
    },
  );
};
