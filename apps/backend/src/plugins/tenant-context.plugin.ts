import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
    correlationId: string;
    traceId: string;
  }
}

/**
 * Resuelve el tenant de cada request desde el header `x-tenant-id` y arma el
 * contexto de observabilidad (tenantId, correlationId, traceId) que Pino
 * adjunta a TODOS los logs de ese request vía request.log.child(...).
 * `requestId` ya viene incluido por Fastify como `reqId` en cada child logger.
 *
 * En producción esto debería derivarse de un JWT validado, pero el
 * contrato hacia el resto de la app (request.tenantId) no cambiaría.
 */
export default fp(async function tenantContextPlugin(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    const tenantId = request.headers["x-tenant-id"];
    if (typeof tenantId !== "string" || tenantId.length === 0) {
      return reply.badRequest("Missing required 'x-tenant-id' header");
    }

    const correlationIdHeader = request.headers["x-correlation-id"];
    const traceIdHeader = request.headers["x-trace-id"];

    request.tenantId = tenantId;
    request.correlationId =
      typeof correlationIdHeader === "string" && correlationIdHeader.length > 0
        ? correlationIdHeader
        : randomUUID();
    request.traceId =
      typeof traceIdHeader === "string" && traceIdHeader.length > 0
        ? traceIdHeader
        : randomUUID();

    const childLogger = request.log.child({
      tenantId: request.tenantId,
      correlationId: request.correlationId,
      traceId: request.traceId,
    });
    // request.log y reply.log son propiedades independientes en Fastify
    // (no un getter compartido): hay que reasignar ambas para que el log
    // final de "request completed" también lleve el contexto de tenant.
    request.log = childLogger;
    reply.log = childLogger;
  });
});
