import { randomUUID } from "node:crypto";
import Fastify, { LogController } from "fastify";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { InventoryEventRepository } from "@indinv/core-domain";
import tenantContextPlugin from "./plugins/tenant-context.plugin.js";
import { scanEventsRoutes } from "./routes/scan-events.routes.js";
import { scansRoutes } from "./routes/scans.js";
import { operationsRoutes } from "./routes/operations.routes.js";
import { telemetryRoutes } from "./routes/telemetry.routes.js";

export interface BuildAppOptions {
  /** Permite inyectar un repositorio in-memory en tests de integración. */
  repository?: InventoryEventRepository;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    logController: new LogController({ requestIdLogLabel: "requestId" }),
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      return typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(sensible);
  app.get("/health", async () => ({ status: "ok" }));

  app.register(async (scoped) => {
    scoped.register(tenantContextPlugin);
    scoped.register(scanEventsRoutes, { repository: options.repository });
    scoped.register(scansRoutes, { repository: options.repository, prefix: "/api/v1" });
    scoped.register(operationsRoutes, { repository: options.repository, prefix: "/api/v1" });
    scoped.register(telemetryRoutes, { prefix: "/api/v1" });
  });

  return app;
}
