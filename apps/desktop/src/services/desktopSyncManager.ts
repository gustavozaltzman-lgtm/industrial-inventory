import Database from "@tauri-apps/plugin-sql";
import type { InventoryScanEvent } from "@indinv/core-domain";
import { tauriBridge } from "./tauriBridge";

const DB_URL = "sqlite:indinv-desktop.sqlite";
const BATCH_SIZE = 200; // mayor que en mobile: desktop no corre a batería.

interface LocalRow {
  id: string;
  tenant_id: string;
  correlation_id: string;
  warehouse_id: string;
  location_id: string | null;
  sku_id: string;
  event_type: string;
  quantity: number;
  capture_source: string;
  device_id: string | null;
  sequence_number: number | null;
  operator_id: string | null;
  image_ref: string | null;
  metadata_json: string | null;
  captured_at: string;
  recorded_at: string | null;
  sync_status: string;
}

function toDomainEvent(row: LocalRow): InventoryScanEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    correlationId: row.correlation_id,
    warehouseId: row.warehouse_id,
    locationId: row.location_id ?? undefined,
    skuId: row.sku_id,
    eventType: row.event_type as InventoryScanEvent["eventType"],
    quantity: row.quantity,
    captureSource: row.capture_source as InventoryScanEvent["captureSource"],
    deviceId: row.device_id ?? undefined,
    sequenceNumber: row.sequence_number ?? undefined,
    operatorId: row.operator_id ?? undefined,
    imageRef: row.image_ref ?? undefined,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    capturedAt: row.captured_at,
    recordedAt: row.recorded_at ?? undefined,
    syncStatus: row.sync_status as InventoryScanEvent["syncStatus"],
  };
}

async function compress(payload: string): Promise<Blob> {
  // CompressionStream es soportado por WebView2 y WKWebView modernos, que
  // son los motores reales detrás de Tauri en Windows/macOS. Si no está
  // disponible (Linux con un WebKitGTK viejo), se envía sin comprimir en
  // vez de fallar la sincronización por completo.
  if (typeof CompressionStream === "undefined") {
    return new Blob([payload], { type: "application/json" });
  }
  const stream = new Blob([payload]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

export interface SyncOptions {
  apiBaseUrl: string;
  tenantId: string;
  authToken?: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
}

/**
 * Motor de sincronización pesada del cliente de escritorio.
 *
 * A diferencia de apps/mobile, acá NO se pasa por el BFF de apps/web (no
 * existe: es un export estático sin servidor Node) — se habla directo con
 * el mismo endpoint idempotente del backend (POST /api/v1/scans/batch,
 * Tarea #3), enviando el tenantId explícito en el header porque no hay
 * sesión de navegador que lo resuelva por nosotros.
 */
export class DesktopSyncManager {
  private db: Database | null = null;

  private async connect(): Promise<Database> {
    if (this.db) return this.db;
    if (!tauriBridge.isNative()) {
      throw new Error("DesktopSyncManager requiere el runtime nativo de Tauri");
    }
    this.db = await Database.load(DB_URL);
    return this.db;
  }

  async countPending(tenantId: string): Promise<number> {
    const db = await this.connect();
    const rows = await db.select<{ c: number }[]>(
      "SELECT COUNT(*) as c FROM inventory_scan_events_local WHERE tenant_id = $1 AND sync_status = 'pending_sync'",
      [tenantId],
    );
    return rows[0]?.c ?? 0;
  }

  private async claimBatch(tenantId: string): Promise<InventoryScanEvent[]> {
    const db = await this.connect();
    const rows = await db.select<LocalRow[]>(
      `SELECT * FROM inventory_scan_events_local
       WHERE tenant_id = $1 AND sync_status = 'pending_sync'
       ORDER BY sequence_number ASC LIMIT $2`,
      [tenantId, BATCH_SIZE],
    );
    return rows.map(toDomainEvent);
  }

  private async markSynced(ids: string[], recordedAt: string): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.connect();
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
    await db.execute(
      `UPDATE inventory_scan_events_local
       SET sync_status = 'synced', recorded_at = $1
       WHERE id IN (${placeholders})`,
      [recordedAt, ...ids],
    );
  }

  private async markFailed(ids: string[], reason: string): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.connect();
    const placeholders = ids.map((_, i) => `$${i + 2}`).join(",");
    await db.execute(
      `UPDATE inventory_scan_events_local
       SET sync_attempts = sync_attempts + 1, last_sync_error = $1
       WHERE id IN (${placeholders})`,
      [reason.slice(0, 500), ...ids],
    );
  }

  private async pushBatch(events: InventoryScanEvent[], options: SyncOptions): Promise<void> {
    const payload = JSON.stringify({ events });
    const body = await compress(payload);
    const isCompressed = typeof CompressionStream !== "undefined";

    const response = await fetch(`${options.apiBaseUrl}/api/v1/scans/batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(isCompressed ? { "content-encoding": "gzip" } : {}),
        "x-tenant-id": options.tenantId,
        "x-correlation-id": crypto.randomUUID(),
        ...(options.authToken ? { authorization: `Bearer ${options.authToken}` } : {}),
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Sync batch failed with status ${response.status}`);
    }
  }

  /** Drena la cola local en lotes hasta que no queden eventos elegibles. */
  async syncNow(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, failed: 0 };

    for (;;) {
      const batch = await this.claimBatch(options.tenantId);
      if (batch.length === 0) break;

      const ids = batch.map((event) => event.id);
      try {
        await this.pushBatch(batch, options);
        await this.markSynced(ids, new Date().toISOString());
        result.synced += batch.length;
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown sync error";
        await this.markFailed(ids, reason);
        result.failed += batch.length;
        break; // la red probablemente sigue caída; no insistir con el resto.
      }
    }

    return result;
  }
}

export const desktopSyncManager = new DesktopSyncManager();
