`icon.ico` es un **placeholder** (un cuadrado sólido de 32x32, generado con
System.Drawing, no arte real) — existe únicamente para que `cargo check` /
`cargo build` no fallen por la falta del recurso de Windows. Los demás
binarios de ícono (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`)
no se generaron — son artefactos binarios, no código fuente, y requieren el
CLI de Tauri instalado.

Generarlos corriendo, desde `apps/desktop`, con un PNG fuente de 1024x1024:

```bash
pnpm tauri icon path/to/logo-1024.png
```

Esto puebla este directorio con los tamaños que `tauri.conf.json` espera.
Sin estos archivos, `tauri build` falla al empaquetar (pero `tauri dev` corre igual).
