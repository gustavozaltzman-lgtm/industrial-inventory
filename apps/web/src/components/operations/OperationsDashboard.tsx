"use client";

import { useRealtimeTelemetry } from "@/hooks/useRealtimeTelemetry";
import { OperationsKpiGrid } from "./OperationsKpiGrid";
import { TelemetryFeed } from "./TelemetryFeed";
import { DeviceFleetStatus } from "@/components/devices/DeviceFleetStatus";
import { ReconciliationTable } from "@/components/inventory/ReconciliationTable";

const WINDOW_MINUTES = 60;

/**
 * Ensambla los módulos del Operations Center. El hook de telemetría se monta
 * una sola vez acá y su efecto lateral —invalidar el cache de Query— llega a
 * los hijos a través del cache compartido, sin prop drilling ni un segundo
 * EventSource por componente.
 */
export function OperationsDashboard({ warehouseId }: { warehouseId: string }) {
  const { connection, feed } = useRealtimeTelemetry(warehouseId, WINDOW_MINUTES);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="kpis-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h1 id="kpis-heading" className="text-xl font-semibold tracking-tight">
            Centro de Operaciones
          </h1>
          <p className="text-xs text-muted-foreground">Ventana: últimos {WINDOW_MINUTES} min</p>
        </div>
        <OperationsKpiGrid warehouseId={warehouseId} windowMinutes={WINDOW_MINUTES} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TelemetryFeed feed={feed} connection={connection} />

        <section aria-labelledby="devices-heading" className="flex flex-col gap-2">
          <h2 id="devices-heading" className="text-sm font-semibold">
            Flota de dispositivos
          </h2>
          <DeviceFleetStatus warehouseId={warehouseId} />
        </section>
      </div>

      <section aria-labelledby="reconciliation-heading" className="flex flex-col gap-2">
        <h2 id="reconciliation-heading" className="text-sm font-semibold">
          Conciliación de inventario
        </h2>
        <ReconciliationTable warehouseId={warehouseId} />
      </section>
    </div>
  );
}
