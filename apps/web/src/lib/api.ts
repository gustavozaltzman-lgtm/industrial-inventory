import type { InventoryScanEvent } from "@indinv/core-domain";

const API_BASE_URL = process.env.INDINV_API_URL ?? "http://localhost:3001";

/**
 * Por debajo del límite de ejecución de las funciones serverless de Vercel:
 * preferimos devolver un mensaje accionable a que la plataforma corte la
 * función y muestre un error genérico de infraestructura.
 */
const REQUEST_TIMEOUT_MS = 8_000;

export class BackendUnreachableError extends Error {
  constructor(
    message: string,
    readonly isLikelyColdStart: boolean,
  ) {
    super(message);
    this.name = "BackendUnreachableError";
  }
}

export async function getWarehouseScanEvents(
  tenantId: string,
  warehouseId: string,
): Promise<InventoryScanEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}/scan-events`, {
      headers: { "x-tenant-id": tenantId },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new BackendUnreachableError(
        `El backend respondió ${response.status}`,
        false,
      );
    }

    return (await response.json()) as InventoryScanEvent[];
  } catch (error) {
    if (error instanceof BackendUnreachableError) throw error;

    // El plan free de Render duerme el servicio tras ~15 min de inactividad;
    // el primer request lo despierta pero tarda 30-60s, más de lo que damos.
    if (error instanceof Error && error.name === "AbortError") {
      throw new BackendUnreachableError(
        "El backend no respondió en 8 segundos. Si estuvo inactivo, se está despertando: recargá en un minuto.",
        true,
      );
    }

    throw new BackendUnreachableError(
      error instanceof Error ? error.message : "Error desconocido",
      false,
    );
  } finally {
    clearTimeout(timeout);
  }
}
