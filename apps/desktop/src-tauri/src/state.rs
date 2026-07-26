use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::Mutex;

/// Handle de un puerto serie abierto. `stop` señaliza al hilo de lectura en
/// background que debe terminar; el propio hilo cierra el puerto al salir,
/// así que acá solo se guarda la señal, no el `Box<dyn SerialPort>`.
pub struct SerialPortHandle {
    pub stop: Arc<AtomicBool>,
}

/// Estado compartido de la app nativa, gestionado por Tauri e inyectado en
/// cada comando vía `State<'_, AppState>`. Los dos recursos son de por vida
/// distinta: el pool de SQLite vive mientras la app corre; los puertos
/// serie se abren y cierran según el operador conecta/desconecta hardware.
pub struct AppState {
    pub db: Mutex<Option<SqlitePool>>,
    pub serial_ports: Mutex<HashMap<String, SerialPortHandle>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: Mutex::new(None),
            serial_ports: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
