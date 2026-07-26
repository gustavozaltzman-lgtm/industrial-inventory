import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/server/session";
import { BACKEND_URL } from "@/server/backendGateway";
import { toErrorResponse } from "@/server/routeHelpers";

export const dynamic = "force-dynamic";
// El stream tiene que correr en Node: el runtime edge tiene límites de
// duración que cortarían la conexión SSE a los pocos segundos.
export const runtime = "nodejs";

/**
 * Proxy del stream SSE del backend.
 *
 * Existe para que el EventSource del navegador nunca tenga que enviar
 * `x-tenant-id` — la API de EventSource ni siquiera permite headers custom,
 * así que sin este proxy la única alternativa sería mandar el tenant por
 * query string, que es exactamente el "header trust" que el diseño prohíbe.
 */
export async function GET() {
  try {
    const session = await requireSession();

    const upstream = await fetch(`${BACKEND_URL}/api/v1/events/stream`, {
      headers: {
        accept: "text/event-stream",
        "x-tenant-id": session.tenantId,
        "x-correlation-id": randomUUID(),
        "x-trace-id": randomUUID(),
      },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `El stream respondió ${upstream.status}`, kind: "backend" },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
