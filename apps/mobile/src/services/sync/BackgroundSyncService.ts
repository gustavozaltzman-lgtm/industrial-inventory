import { AppState, type AppStateStatus } from "react-native";
import type { InventoryScanEvent } from "@indinv/core-domain";
import type { DeviceAdapter, NetworkStatus } from "../../adapters/device/DeviceAdapter";
import type { QueueManager } from "./QueueManager";

export interface SyncApiClient {
  /** POST /api/v1/scans/batch — idempotente: reenviar el mismo lote no duplica. */
  pushBatch(tenantId: string, events: InventoryScanEvent[]): Promise<void>;
}

export interface SyncResult {
  synced: number;
  failed: number;
}

export interface BackgroundSyncServiceOptions {
  tenantId: string;
  batchSize?: number;
  onSyncResult?: (result: SyncResult) => void;
}

/**
 * Dispara la sincronización ante: arranque, vuelta a foreground y recuperación
 * de conectividad (WiFi/4G/VPN). No hace polling: en planta el equipo puede
 * pasar horas sin red y despertar la radio cada N segundos come batería.
 *
 * La reentrada está protegida por `inFlight`: si vuelve la red justo cuando el
 * usuario reabre la app, se ejecuta un solo ciclo.
 */
export class BackgroundSyncService {
  private inFlight = false;
  private disposers: Array<() => void> = [];
  private lastNetworkOk = false;

  constructor(
    private readonly queue: QueueManager,
    private readonly api: SyncApiClient,
    private readonly device: DeviceAdapter,
    private readonly options: BackgroundSyncServiceOptions,
  ) {}

  async start(): Promise<void> {
    // Un corte de energía puede dejar eventos marcados 'syncing' para siempre.
    await this.queue.recoverStuckBatches();

    const netUnsub = this.device.onNetworkChange((status) => {
      const isOk = status.isConnected && status.isInternetReachable;
      const recovered = isOk && !this.lastNetworkOk;
      this.lastNetworkOk = isOk;
      if (recovered) void this.syncNow();
    });
    this.disposers.push(netUnsub);

    const appSub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") void this.syncNow();
    });
    this.disposers.push(() => appSub.remove());

    const initial = await this.device.getNetworkStatus();
    this.lastNetworkOk = initial.isConnected && initial.isInternetReachable;
    if (this.lastNetworkOk) await this.syncNow();
  }

  stop(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
  }

  /**
   * Drena la cola en lotes hasta que no queden eventos elegibles. Un lote que
   * falla se devuelve a la cola con backoff y corta el ciclo: si la red se
   * cayó, insistir con los siguientes lotes solo gasta batería.
   */
  async syncNow(): Promise<SyncResult> {
    if (this.inFlight) return { synced: 0, failed: 0 };
    this.inFlight = true;

    const result: SyncResult = { synced: 0, failed: 0 };
    const { tenantId, batchSize = 50 } = this.options;

    try {
      const network = await this.device.getNetworkStatus();
      if (!network.isConnected || !network.isInternetReachable) return result;

      for (;;) {
        const batch = await this.queue.claimBatch(tenantId, batchSize);
        if (batch.length === 0) break;

        const ids = batch.map((event) => event.id);
        try {
          await this.api.pushBatch(tenantId, batch);
          await this.queue.markSynced(ids, new Date().toISOString());
          result.synced += batch.length;
        } catch (error) {
          const reason = error instanceof Error ? error.message : "unknown sync error";
          await this.queue.markFailed(ids, reason);
          result.failed += batch.length;
          break;
        }
      }
    } finally {
      this.inFlight = false;
    }

    this.options.onSyncResult?.(result);
    return result;
  }
}
