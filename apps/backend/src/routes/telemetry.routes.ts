import type { FastifyInstance } from "fastify";
import type { TelemetryEvent } from "@indinv/core-domain";
import { telemetryHub, type TelemetryHub } from "../services/telemetry-hub.js";

/** Mantiene viva la conexión frente a proxies que cortan por inactividad. */
const KEEPALIVE_MS = 25_000;

export interface TelemetryRoutesOptions {
  hub?: TelemetryHub;
}

export async function telemetryRoutes(
  app: FastifyInstance,
  options: TelemetryRoutesOptions = {},
) {
  const hub = options.hub ?? telemetryHub;

  app.get("/events/stream", (request, reply) => {
    const { tenantId } = request;

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Sin esto, algunos proxies bufferean el stream y no llega nada.
      "x-accel-buffering": "no",
    });

    const send = (event: TelemetryEvent) => {
      reply.raw.write(`event: ${event.channel}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Comentario SSE inicial: fuerza el flush de headers para que el cliente
    // pase a readyState OPEN sin esperar al primer evento real.
    reply.raw.write(`: connected\n\n`);

    const unsubscribe = hub.subscribe(tenantId, send);

    const keepalive = setInterval(() => {
      reply.raw.write(`: keepalive\n\n`);
    }, KEEPALIVE_MS);

    const cleanup = () => {
      clearInterval(keepalive);
      unsubscribe();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);

    request.log.info({ subscribers: hub.subscriberCount(tenantId) }, "SSE client connected");
  });
}
