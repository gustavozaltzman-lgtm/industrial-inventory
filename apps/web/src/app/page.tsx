import type { InventoryScanEvent, SyncStatus } from "@indinv/core-domain";
import { getWarehouseScanEvents } from "@/lib/api";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_WAREHOUSE_ID = "00000000-0000-0000-0000-000000000002";

const SYNC_STATUS_VARIANT: Record<SyncStatus, NonNullable<BadgeProps["variant"]>> = {
  pending_sync: "warning",
  synced: "success",
  sync_failed: "destructive",
};

export default async function DashboardPage() {
  let events: InventoryScanEvent[];
  let error: string | null = null;

  try {
    events = await getWarehouseScanEvents(DEMO_TENANT_ID, DEMO_WAREHOUSE_ID);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
    events = [];
  }

  return (
    <main className="container max-w-4xl py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">IndInv — Eventos de Inventario</h1>
        <p className="text-sm text-muted-foreground">Warehouse demo: {DEMO_WAREHOUSE_ID}</p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No se pudo conectar al backend (
          {process.env.INDINV_API_URL ?? "http://localhost:3001"}): {error}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead>Sync</TableHead>
              <TableHead>Capturado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && !error && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Sin eventos registrados todavía.
                </TableCell>
              </TableRow>
            )}
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{event.eventType}</TableCell>
                <TableCell>{event.quantity}</TableCell>
                <TableCell>{event.captureSource}</TableCell>
                <TableCell>
                  <Badge variant={SYNC_STATUS_VARIANT[event.syncStatus]}>
                    {event.syncStatus}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(event.capturedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
