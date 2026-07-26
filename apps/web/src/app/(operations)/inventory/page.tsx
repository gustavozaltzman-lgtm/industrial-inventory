import { ReconciliationTable } from "@/components/inventory/ReconciliationTable";
import { DEMO_WAREHOUSE_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Conciliación entre stock teórico y conteo real.
        </p>
      </div>
      <ReconciliationTable warehouseId={DEMO_WAREHOUSE_ID} />
    </div>
  );
}
