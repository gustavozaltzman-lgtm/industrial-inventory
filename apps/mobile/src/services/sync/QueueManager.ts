import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { InventoryScanEvent } from "@indinv/core-domain";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "../../db/schema.js";

const events = schema.inventoryScanEventsLocal;

export interface BackoffPolicy {
  baseDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
}

export const DEFAULT_BACKOFF: BackoffPolicy = {
  baseDelayMs: 5_000,
  maxDelayMs: 5 * 60_000,
  maxAttempts: 10,
};

/**
 * Backoff exponencial con jitter. El jitter evita el "thundering herd": si
 * 40 equipos de un depósito pierden el WiFi a la vez y lo recuperan juntos,
 * sin jitter reintentarían todos en el mismo milisegundo contra el backend.
 */
export function computeBackoffMs(attempt: number, policy: BackoffPolicy = DEFAULT_BACKOFF): number {
  const exponential = Math.min(policy.baseDelayMs * 2 ** attempt, policy.maxDelayMs);
  const jitter = Math.random() * exponential * 0.3;
  return Math.round(exponential - jitter);
}

/**
 * Gestiona la cola de subida sobre SQLite (no en memoria: tiene que sobrevivir
 * a que el sistema mate la app). Ciclo de un evento:
 *
 *   pending_sync --claimBatch--> syncing --markSynced--> synced
 *                                   |
 *                                   +---markFailed--> pending_sync (con
 *                                       nextRetryAt en el futuro) o
 *                                       sync_failed si agotó los intentos.
 */
export class QueueManager {
  constructor(
    private readonly db: ExpoSQLiteDatabase<typeof schema>,
    private readonly policy: BackoffPolicy = DEFAULT_BACKOFF,
  ) {}

  /**
   * Toma hasta `limit` eventos elegibles y los marca `syncing` en el acto,
   * de modo que dos disparadores concurrentes no reclamen el mismo lote.
   * Ordena por sequenceNumber para preservar el orden de captura del equipo.
   */
  async claimBatch(tenantId: string, limit = 50): Promise<InventoryScanEvent[]> {
    const now = Date.now();

    const candidates = await this.db
      .select()
      .from(events)
      .where(
        and(
          eq(events.tenantId, tenantId),
          eq(events.syncStatus, "pending_sync"),
          or(isNull(events.nextRetryAt), lte(events.nextRetryAt, now)),
        ),
      )
      .orderBy(asc(events.sequenceNumber))
      .limit(limit);

    if (candidates.length === 0) return [];

    const ids = candidates.map((row) => row.id);
    await this.db.update(events).set({ syncStatus: "syncing" }).where(inArray(events.id, ids));

    return candidates.map(toDomainEvent);
  }

  async markSynced(ids: string[], recordedAt: string): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(events)
      .set({ syncStatus: "synced", recordedAt, lastSyncError: null, nextRetryAt: null })
      .where(inArray(events.id, ids));
  }

  /**
   * Devuelve el lote a la cola con el próximo intento agendado. Si agotó
   * `maxAttempts` lo deja en `sync_failed` para revisión manual — nunca se
   * descarta un escaneo, aunque no se pueda subir.
   */
  async markFailed(ids: string[], reason: string): Promise<void> {
    if (ids.length === 0) return;

    const rows = await this.db
      .select({ id: events.id, syncAttempts: events.syncAttempts })
      .from(events)
      .where(inArray(events.id, ids));

    const now = Date.now();
    for (const row of rows) {
      const attempts = row.syncAttempts + 1;
      const exhausted = attempts >= this.policy.maxAttempts;

      await this.db
        .update(events)
        .set({
          syncStatus: exhausted ? "sync_failed" : "pending_sync",
          syncAttempts: attempts,
          lastSyncError: reason.slice(0, 500),
          nextRetryAt: exhausted ? null : now + computeBackoffMs(attempts, this.policy),
        })
        .where(eq(events.id, row.id));
    }
  }

  /**
   * Devuelve a la cola cualquier evento que haya quedado en `syncing` — pasa
   * si el SO mató la app a mitad de una subida. Se llama al arrancar.
   */
  async recoverStuckBatches(): Promise<number> {
    const stuck = await this.db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.syncStatus, "syncing"));

    if (stuck.length > 0) {
      await this.db
        .update(events)
        .set({ syncStatus: "pending_sync" })
        .where(eq(events.syncStatus, "syncing"));
    }
    return stuck.length;
  }

  async countPending(tenantId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(eq(events.tenantId, tenantId), eq(events.syncStatus, "pending_sync")));
    return row?.count ?? 0;
  }
}

function toDomainEvent(row: typeof events.$inferSelect): InventoryScanEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    correlationId: row.correlationId,
    warehouseId: row.warehouseId,
    locationId: row.locationId ?? undefined,
    skuId: row.skuId,
    eventType: row.eventType as InventoryScanEvent["eventType"],
    quantity: row.quantity,
    captureSource: row.captureSource as InventoryScanEvent["captureSource"],
    deviceId: row.deviceId ?? undefined,
    sequenceNumber: row.sequenceNumber ?? undefined,
    operatorId: row.operatorId ?? undefined,
    imageRef: row.imageRef ?? undefined,
    metadata: row.metadataJson ? JSON.parse(row.metadataJson) : undefined,
    capturedAt: row.capturedAt,
    recordedAt: row.recordedAt ?? undefined,
    // Va al backend como pendiente; el estado 'syncing' es local.
    syncStatus: "pending_sync",
    adjustsEventId: row.adjustsEventId ?? undefined,
  };
}
