import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema.js";

/**
 * TODO producción: habilitar SQLCipher (esquema encriptado) para datos
 * sensibles en dispositivo, según ADR-001 §4. Los tokens ya van por
 * SecureStore (ver SecureTokenStore), esto es para el cuerpo de los eventos.
 */
const sqlite = openDatabaseSync("indinv.db");

export const db = drizzle(sqlite, { schema });
export type LocalDb = typeof db;

const CREATE_EVENTS_TABLE = `
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
  sequence_number INTEGER,
  operator_id TEXT,
  image_ref TEXT,
  metadata_json TEXT,
  captured_at TEXT NOT NULL,
  recorded_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending_sync',
  adjusts_event_id TEXT,
  created_offline_at TEXT NOT NULL,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT,
  next_retry_at INTEGER
);
`;

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS local_tenant_sync_idx
  ON inventory_scan_events_local (tenant_id, sync_status);
CREATE INDEX IF NOT EXISTS local_tenant_sequence_idx
  ON inventory_scan_events_local (tenant_id, sequence_number);
`;

const CREATE_SEQUENCE_TABLE = `
CREATE TABLE IF NOT EXISTS device_sequence (
  device_id TEXT PRIMARY KEY NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0
);
`;

export function initLocalDb(): void {
  sqlite.execSync(CREATE_EVENTS_TABLE);
  sqlite.execSync(CREATE_INDEXES);
  sqlite.execSync(CREATE_SEQUENCE_TABLE);
}
