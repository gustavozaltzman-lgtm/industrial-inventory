import type { InventoryScanEvent } from "@indinv/core-domain";
import type { SyncApiClient } from "./BackgroundSyncService";
import type { SecureTokenStore } from "../../adapters/secure-token-store";

export interface HttpSyncApiClientOptions {
  baseUrl: string;
  tokenStore?: SecureTokenStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Cliente del endpoint de ingesta por lote del backend.
 *
 * Apunta a /api/v1/scans/batch (no a /scan-events/batch) porque esa ruta
 * deduplica por id de evento: un reintento tras un timeout no duplica stock,
 * que es exactamente la garantía que necesita un cliente offline.
 */
export class HttpSyncApiClient implements SyncApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpSyncApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async pushBatch(tenantId: string, events: InventoryScanEvent[]): Promise<void> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      // Correlaciona el lote con los logs estructurados del backend.
      "x-correlation-id": events[0]?.correlationId ?? globalThis.crypto.randomUUID(),
    };

    const credentials = await this.options.tokenStore?.load();
    if (credentials) headers.authorization = `Bearer ${credentials.token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000);

    try {
      const response = await this.fetchImpl(`${this.options.baseUrl}/api/v1/scans/batch`, {
        method: "POST",
        headers,
        body: JSON.stringify({ events }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Sync batch failed with status ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
