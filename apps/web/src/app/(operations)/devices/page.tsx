import { DeviceFleetStatus } from "@/components/devices/DeviceFleetStatus";
import { DEMO_WAREHOUSE_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default function DevicesPage() {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dispositivos</h1>
        <p className="text-sm text-muted-foreground">
          Salud de la flota: escáneres, smartphones y robots con actividad en las últimas 24 h.
        </p>
      </div>
      <DeviceFleetStatus warehouseId={DEMO_WAREHOUSE_ID} />
    </div>
  );
}
