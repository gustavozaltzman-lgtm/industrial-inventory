use serde::{Serialize, Serializer};

/// Error único para todos los comandos IPC. Cada comando de Tauri debe
/// devolver `Result<T, E>` con `E: Serialize` para que el WebView reciba un
/// error estructurado en vez de un panic silencioso — nunca se usa
/// `.unwrap()` en un comando expuesto al frontend.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("error de base de datos: {0}")]
    Database(#[from] sqlx::Error),

    #[error("error de puerto serie: {0}")]
    SerialPort(#[from] serialport::Error),

    #[error("puerto '{0}' no está conectado")]
    PortNotConnected(String),

    #[error("error de I/O: {0}")]
    Io(#[from] std::io::Error),

    #[error("no se pudo resolver el directorio de datos de la aplicación")]
    AppDataDirUnavailable,

    #[error("{0}")]
    Other(String),
}

// thiserror no deriva Serialize: Tauri exige que el error de cada comando lo
// sea para poder cruzar el puente IPC. Se serializa como el mensaje ya
// formateado por Display, que es lo único que le interesa al frontend.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
