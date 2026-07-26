import { OperationsDashboard } from "@/components/operations/OperationsDashboard";
import { getSession } from "@/server/session";
import { DEMO_WAREHOUSE_ID } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // El tenant se resuelve en el servidor; la página solo comprueba que haya
  // sesión para poder mostrar el estado Unauthorized sin llamar a la API.
  const session = await getSession();

  if (!session) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center text-sm text-destructive"
      >
        <p className="font-medium">Sesión no disponible</p>
        <p className="mt-1">
          Configurá <code>INDINV_DEV_TENANT_ID</code> en el entorno del servidor, o iniciá sesión
          cuando la autenticación esté disponible.
        </p>
      </div>
    );
  }

  return <OperationsDashboard warehouseId={DEMO_WAREHOUSE_ID} />;
}
