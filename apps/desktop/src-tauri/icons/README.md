Los binarios de ícono (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`,
`icon.ico`) no se generan como parte de este cambio — son artefactos binarios,
no código fuente, y requieren el CLI de Tauri instalado.

Generarlos corriendo, desde `apps/desktop`, con un PNG fuente de 1024x1024:

```bash
pnpm tauri icon path/to/logo-1024.png
```

Esto puebla este directorio con los tamaños que `tauri.conf.json` espera.
Sin estos archivos, `tauri build` falla al empaquetar (pero `tauri dev` corre igual).
