mod commands;
mod error;
mod state;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

use commands::{db, hardware};
use state::AppState;

/// Punto de entrada de la librería nativa. Separado de `main.rs` porque
/// Tauri v2 exige exponer `run()` como símbolo de librería para que el
/// bundler móvil (no usado acá, pero parte del template estándar) también
/// pueda invocarlo.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            hardware::list_serial_ports,
            hardware::connect_serial_port,
            hardware::disconnect_serial_port,
            hardware::connected_serial_ports,
            db::init_db,
            db::get_db_stats,
            db::vacuum_db,
        ])
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación IndInv Desktop");
}

/// Ícono de bandeja: en planta la app suele quedar minimizada mientras el
/// operador trabaja con el hardware; la bandeja evita perderla entre
/// ventanas y da acceso rápido a salir sin buscar el ícono en la barra.
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Mostrar", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
