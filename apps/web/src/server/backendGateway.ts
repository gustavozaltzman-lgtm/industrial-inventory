import "server-only";
import { randomUUID } from "node:crypto";
import { requireSession, type Session } from "./session";

const BACKEND_URL = process.env.INDINV_API_URL ?? "http://localhost:3001";

/** Por debajo del límite de las funciones serverless de Vercel. */
const DEFAULT_TIMEOUT_MS = 8_000;

export interface GatewayRequest {
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  /** Se propaga para poder correlacionar la traza extremo a extremo. */
  correlationId?: string;
}

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isTimeout: boolean,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * Único punto por el que la web habla con el backend.
 *
 * Acá se materializa el principio de "No Header Trust": `x-tenant-id` se
 * construye a partir de la sesión resuelta en el servidor, y cualquier header
 * de tenant que hubiera mandado el navegador se descarta — nunca se reenvía
 * nada de la request entrante.
 */
export async function callBackend<T>(request: GatewayRequest): Promise<T> {
  const session: Session = await requireSession();
  const correlationId = request.correlationId ?? randomUUID();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_URL}${request.path}`, {
      method: request.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": session.tenantId,
        "x-correlation-id": correlationId,
        "x-trace-id": randomUUID(),
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BackendError(`El backend respondió ${response.status}`, response.status, false);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BackendError) throw error;

    // El plan free de Render duerme el servicio; despertarlo puede tardar más
    // de lo que dura una función serverless. Se distingue para que la UI
    // pueda sugerir "recargá en un minuto" en vez de mostrar una falla.
    if (error instanceof Error && error.name === "AbortError") {
      throw new BackendError("El backend no respondió a tiempo", 504, true);
    }
    throw new BackendError(
      error instanceof Error ? error.message : "Error desconocido",
      502,
      false,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export { BACKEND_URL };
