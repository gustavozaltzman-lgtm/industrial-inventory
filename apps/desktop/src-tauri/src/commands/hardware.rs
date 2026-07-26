use std::io::ErrorKind;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, AppResult};
use crate::state::{AppState, SerialPortHandle};

const READ_TIMEOUT: Duration = Duration::from_millis(200);
const BAUD_RATE_DEFAULT: u32 = 9600;

#[derive(Debug, Clone, Serialize)]
pub struct SerialPortInfo {
    pub port_name: String,
    pub kind: String,
}

/// Payload del evento `hardware-scan` emitido al WebView. `raw` viaja
/// crudo (base64 no aplica: es texto de lectores/balanzas) y la UI decide
/// cómo interpretarlo — el core de Rust no conoce el protocolo de cada
/// fabricante, solo transporta bytes de una fuente a otra.
#[derive(Debug, Clone, Serialize)]
pub struct HardwareScanEvent {
    pub port_name: String,
    pub raw: String,
    pub received_at_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct HardwareErrorEvent {
    pub port_name: String,
    pub message: String,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Lista los puertos COM/USB visibles para el sistema operativo. Es una
/// llamada barata (consulta al SO, no abre el puerto) pensada para poblar
/// un selector en la UI antes de conectar.
#[tauri::command]
pub fn list_serial_ports() -> AppResult<Vec<SerialPortInfo>> {
    let ports = serialport::available_ports()?;
    Ok(ports
        .into_iter()
        .map(|p| SerialPortInfo {
            port_name: p.port_name,
            kind: format!("{:?}", p.port_type),
        })
        .collect())
}

/// Abre `port_name` y arranca un hilo de fondo que reenvía cada línea leída
/// como evento `hardware-scan`. El hilo vive fuera del runtime async de
/// Tauri a propósito: la lectura de puerto serie es bloqueante por
/// naturaleza y no conviene ocupar un worker de tokio con I/O bloqueante.
#[tauri::command]
pub async fn connect_serial_port(
    app: AppHandle,
    state: State<'_, AppState>,
    port_name: String,
    baud_rate: Option<u32>,
) -> AppResult<()> {
    let mut ports = state.serial_ports.lock().await;
    if ports.contains_key(&port_name) {
        return Ok(()); // idempotente: reconectar un puerto ya abierto es un no-op.
    }

    let port = serialport::new(&port_name, baud_rate.unwrap_or(BAUD_RATE_DEFAULT))
        .timeout(READ_TIMEOUT)
        .open()?;

    let stop = Arc::new(AtomicBool::new(false));
    let stop_for_thread = Arc::clone(&stop);
    let app_for_thread = app.clone();
    let port_name_for_thread = port_name.clone();

    std::thread::spawn(move || {
        read_loop(app_for_thread, port_name_for_thread, port, stop_for_thread);
    });

    ports.insert(port_name, SerialPortHandle { stop });
    Ok(())
}

fn read_loop(
    app: AppHandle,
    port_name: String,
    mut port: Box<dyn serialport::SerialPort>,
    stop: Arc<AtomicBool>,
) {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 256];

    while !stop.load(Ordering::Relaxed) {
        match port.read(&mut chunk) {
            Ok(0) => continue,
            Ok(n) => {
                buffer.extend_from_slice(&chunk[..n]);
                // La mayoría de lectores de mesa terminan la lectura en CR/LF;
                // se flushea línea por línea en vez de por cada byte.
                while let Some(pos) = buffer.iter().position(|&b| b == b'\n' || b == b'\r') {
                    let line: Vec<u8> = buffer.drain(..=pos).collect();
                    let text = String::from_utf8_lossy(&line).trim().to_string();
                    if text.is_empty() {
                        continue;
                    }
                    let _ = app.emit(
                        "hardware-scan",
                        HardwareScanEvent {
                            port_name: port_name.clone(),
                            raw: text,
                            received_at_ms: now_ms(),
                        },
                    );
                }
            }
            Err(ref e) if e.kind() == ErrorKind::TimedOut => continue,
            Err(e) => {
                let _ = app.emit(
                    "hardware-error",
                    HardwareErrorEvent {
                        port_name: port_name.clone(),
                        message: e.to_string(),
                    },
                );
                break;
            }
        }
    }
}

#[tauri::command]
pub async fn disconnect_serial_port(
    state: State<'_, AppState>,
    port_name: String,
) -> AppResult<()> {
    let mut ports = state.serial_ports.lock().await;
    match ports.remove(&port_name) {
        Some(handle) => {
            handle.stop.store(true, Ordering::Relaxed);
            Ok(())
        }
        None => Err(AppError::PortNotConnected(port_name)),
    }
}

#[tauri::command]
pub async fn connected_serial_ports(state: State<'_, AppState>) -> AppResult<Vec<String>> {
    let ports = state.serial_ports.lock().await;
    Ok(ports.keys().cloned().collect())
}
