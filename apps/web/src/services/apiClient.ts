import type { DeviceSnapshot, OperationsKpis, ReconciliationRow } from "@indinv/core-domain";

export type ApiErrorKind = "unauthorized" | "timeout" | "backend" | "unknown";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: ApiErrorKind,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorBody {
  error?: string;
  kind?: ApiErrorKind;
}

/**
 * Cliente HTTP centralizado. Ningún componente ni hook llama a `fetch` de
 * forma directa: todo pasa por acá.
 *
 * Apunta a los route handlers de Next (mismo origen), no al backend. Esto es
 * deliberado y es lo que sostiene el principio de "No Header Trust": la
 * identidad del tenant y el JWT viven del lado servidor, y el navegador nunca
 * ve ni puede manipular esas credenciales. Por eso este cliente no expone
 * ninguna forma de setear el tenant.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      // Permite correlacionar la acción del operador con la traza del backend.
      "x-correlation-id": crypto.randomUUID(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // Respuesta sin JSON (502 de la plataforma, HTML de error, etc.).
    }
    throw new ApiError(
      body.error ?? `Request failed with status ${response.status}`,
      response.status,
      body.kind ?? (response.status === 401 ? "unauthorized" : "unknown"),
    );
  }

  return (await response.json()) as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}

export const apiClient = {
  getOperationsKpis(warehouseId: string, windowMinutes = 60): Promise<OperationsKpis> {
    return request<OperationsKpis>(`/api/operations/kpis?${query({ warehouseId, windowMinutes })}`);
  },

  getDeviceFleet(warehouseId: string): Promise<DeviceSnapshot[]> {
    return request<DeviceSnapshot[]>(`/api/operations/devices?${query({ warehouseId })}`);
  },

  getReconciliation(warehouseId: string): Promise<ReconciliationRow[]> {
    return request<ReconciliationRow[]>(
      `/api/operations/reconciliation?${query({ warehouseId })}`,
    );
  },
};

export const TELEMETRY_STREAM_PATH = "/api/telemetry/stream";
