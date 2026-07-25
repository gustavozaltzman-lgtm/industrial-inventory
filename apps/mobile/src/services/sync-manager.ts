import type { InventoryScanEvent } from "@indinv/core-domain";
import type { SqliteInventoryEventRepository } from "../adapters/sqlite-inventory-event.repository.js";

const BATCH_SIZE = 50;

export interface SyncManagerOptions {
  apiBaseUrl: string;
  tenantId: string;
  fetchImpl?: typeof fetch;
}

/**
 * Procesa en lotes los eventos locales con syncStatus = 'pending_sync' y los
 * envía al backend cuando hay conectividad (ADR-001 §4). Se invoca desde un
 * listener de NetInfo o una tarea en background (expo-task-manager).
 */
export class SyncManager {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly repository: SqliteInventoryEventRepository,
    private readonly options: SyncManagerOptions,
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async syncPendingEvents(): Promise<{ synced: number; failed: number }> {
    const pending = await this.repository.findPendingSync(this.options.tenantId);
    let synced = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      try {
        await this.pushBatch(batch);
        const recordedAt = new Date().toISOString();
        for (const event of batch) {
          await this.repository.markSynced(event.id, recordedAt);
        }
        synced += batch.length;
      } catch (error) {
        for (const event of batch) {
          await this.repository.markSyncFailed(event.id);
        }
        failed += batch.length;
      }
    }

    return { synced, failed };
  }

  private async pushBatch(batch: InventoryScanEvent[]): Promise<void> {
    const response = await this.fetchImpl(`${this.options.apiBaseUrl}/scan-events/batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": this.options.tenantId,
      },
      body: JSON.stringify({ events: batch }),
    });

    if (!response.ok) {
      throw new Error(`Sync batch failed with status ${response.status}`);
    }
  }
}
