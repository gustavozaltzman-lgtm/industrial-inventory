use serde::Serialize;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;
use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

const DB_FILE_NAME: &str = "indinv-desktop.sqlite";

/// Espejo local del esquema `inventory_scan_events` del backend (ver
/// packages/core-domain). Las columnas siguen el mismo nombre y tipo que la
/// entidad de dominio para que el mapeo en desktopSyncManager.ts sea directo,
/// sin una capa de traducción intermedia que pueda divergir.
const SCHEMA_SQL: &str = r#"
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
  last_sync_error TEXT
);
CREATE INDEX IF NOT EXISTS local_tenant_sync_idx
  ON inventory_scan_events_local (tenant_id, sync_status);

CREATE TABLE IF NOT EXISTS captured_photos (
  id TEXT PRIMARY KEY NOT NULL,
  scan_event_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  uploaded INTEGER NOT NULL DEFAULT 0
);
"#;

#[derive(Debug, Serialize)]
pub struct DbStats {
    pub path: String,
    pub size_bytes: u64,
    pub pending_events: i64,
    pub captured_photos: i64,
}

fn db_path(app: &AppHandle) -> AppResult<std::path::PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| AppError::AppDataDirUnavailable)?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(DB_FILE_NAME))
}

/// Abre (o crea) la base local y aplica el schema. Es idempotente a
/// propósito: se invoca al arrancar la app sin necesidad de que el frontend
/// sepa si es la primera vez que corre.
#[tauri::command]
pub async fn init_db(app: AppHandle, state: State<'_, AppState>) -> AppResult<String> {
    let path = db_path(&app)?;
    let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());

    let pool = SqlitePoolOptions::new().max_connections(4).connect(&url).await?;
    sqlx::query(SCHEMA_SQL).execute(&pool).await?;

    *state.db.lock().await = Some(pool);
    Ok(path.to_string_lossy().to_string())
}

async fn require_pool(state: &State<'_, AppState>) -> AppResult<sqlx::SqlitePool> {
    state
        .db
        .lock()
        .await
        .clone()
        .ok_or_else(|| AppError::Other("init_db no fue invocado todavía".into()))
}

/// Tamaño en disco y conteos básicos, para el widget de estado de hardware
/// (barra de "almacenamiento local SQLite").
#[tauri::command]
pub async fn get_db_stats(app: AppHandle, state: State<'_, AppState>) -> AppResult<DbStats> {
    let pool = require_pool(&state).await?;
    let path = db_path(&app)?;
    let size_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    let pending: i64 = sqlx::query(
        "SELECT COUNT(*) as c FROM inventory_scan_events_local WHERE sync_status = 'pending_sync'",
    )
    .fetch_one(&pool)
    .await?
    .try_get("c")?;

    let photos: i64 = sqlx::query("SELECT COUNT(*) as c FROM captured_photos")
        .fetch_one(&pool)
        .await?
        .try_get("c")?;

    Ok(DbStats {
        path: path.to_string_lossy().to_string(),
        size_bytes,
        pending_events: pending,
        captured_photos: photos,
    })
}

/// Compacta el archivo SQLite. Se expone como comando manual (no automático)
/// porque VACUUM reescribe el archivo completo: en una base de varios GB de
/// fotos e historial, es una operación que el operador debe disparar a
/// conciencia, no algo que corra solo en background.
#[tauri::command]
pub async fn vacuum_db(state: State<'_, AppState>) -> AppResult<()> {
    let pool = require_pool(&state).await?;
    sqlx::query("VACUUM").execute(&pool).await?;
    Ok(())
}
