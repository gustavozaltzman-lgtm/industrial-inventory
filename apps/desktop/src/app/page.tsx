"use client";

import { HardwareStatusWidget } from "@/components/desktop/HardwareStatusWidget";

/**
 * Shell mínimo del cliente de escritorio. El Operations Center completo
 * (KPIs, flota, conciliación) se reutiliza desde @indinv/web en un paso
 * posterior — fuera del alcance de esta tarea, que se limita al puente
 * nativo, la sincronización y el widget de hardware. Ver ARCHITECTURE.md
 * sobre por qué el BFF de la web no aplica acá (no hay servidor Node en un
 * export estático).
 */
export default function DesktopHome() {
  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>IndInv Desktop</h1>
      <HardwareStatusWidget />
    </main>
  );
}
