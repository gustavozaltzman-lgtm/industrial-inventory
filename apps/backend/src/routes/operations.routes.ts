import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  operationsKpisSchema,
  type DeviceSnapshot,
  type InventoryEventRepository,
  type InventoryScanEvent,
  type ReconciliationRow,
} from "@indinv/core-domain";
import { PostgresInventoryEventRepository } from "../adapters/persistence/inventory-event.repository.js";
import { ReconciliationRepository } from "../adapters/persistence/reconciliation.repository.js";
import { db } from "../adapters/persistence/db.js";
import { computeOperationsKpis } from "../services/operations-kpis.service.js";
import { buildDeviceSnapshots } from "../services/device-fleet.service.js";

export interface OperationsRoutesOptions {
  repository?: InventoryEventRepository;
  reconciliation?: Pick<ReconciliationRepository, "listByWarehouse">;
}

const kpisQuerySchema = z.object({
  warehouseId: z.string().uuid(),
  windowMinutes: z.coerce.number().int().positive().max(1440).default(60),
});

const fleetQuerySchema = z.object({
  warehouseId: z.string().uuid(),
});

export const operationsRoutes: FastifyPluginAsyncZod<OperationsRoutesOptions> = async (
  app,
  options,
) => {
  const repository = options.repository ?? new PostgresInventoryEventRepository(db);
  const reconciliation = options.reconciliation ?? new ReconciliationRepository();

  async function loadWindow(
    tenantId: string,
    warehouseId: string,
    windowMinutes: number,
  ): Promise<InventoryScanEvent[]> {
    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60_000);
    return repository.listByWarehouse(tenantId, warehouseId, {
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  app.get(
    "/operations/kpis",
    { schema: { querystring: kpisQuerySchema, response: { 200: operationsKpisSchema } } },
    async (request) => {
      const { warehouseId, windowMinutes } = request.query;
      const events = await loadWindow(request.tenantId, warehouseId, windowMinutes);
      return computeOperationsKpis(events, windowMinutes);
    },
  );

  app.get(
    "/operations/devices",
    { schema: { querystring: fleetQuerySchema } },
    async (request): Promise<DeviceSnapshot[]> => {
      // 24h: un equipo que no aparece en un día completo ya no es "flota activa".
      const events = await loadWindow(request.tenantId, request.query.warehouseId, 1440);
      return buildDeviceSnapshots(request.tenantId, events);
    },
  );

  app.get(
    "/operations/reconciliation",
    { schema: { querystring: fleetQuerySchema } },
    async (request): Promise<ReconciliationRow[]> =>
      reconciliation.listByWarehouse(request.tenantId, request.query.warehouseId),
  );
};
