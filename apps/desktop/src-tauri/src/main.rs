// Ventana de consola oculta en release de Windows; en debug se deja visible
// para poder leer los logs de println!/eprintln! mientras se desarrolla.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    indinv_desktop_lib::run();
}
