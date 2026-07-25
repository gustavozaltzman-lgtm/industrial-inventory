import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema.js";

/**
 * TODO producción: habilitar SQLCipher (esquema encriptado) para datos
 * sensibles en dispositivo, según ADR-001 §4.
 */
const sqlite = openDatabaseSync("indinv.db");

export const db = drizzle(sqlite, { schema });

export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS inventory_scan_events_local (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  location_id TEXT,
  sku_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  capture_source TEXT NOT NULL,
  device_id TEXT,
  operator_id TEXT,
  image_ref TEXT,
  metadata_json TEXT,
  captured_at TEXT NOT NULL,
  recorded_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_sync',
  adjusts_event_id TEXT,
  sync_attempts INTEGER NOT NULL DEFAULT 0
);
`;

export function initLocalDb(): void {
  sqlite.execSync(CREATE_TABLE_SQL);
}
