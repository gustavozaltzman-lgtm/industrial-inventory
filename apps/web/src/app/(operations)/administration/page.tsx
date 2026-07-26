import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const session = await getSession();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Configuración de tenant, depósitos, usuarios y reglas de negocio.
        </p>
      </div>

      <dl className="rounded-lg border p-4 text-sm">
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted-foreground">Tenant activo</dt>
          <dd className="font-mono text-xs">{session?.tenantId ?? "sin sesión"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt className="text-muted-foreground">Rol</dt>
          <dd>{session?.role ?? "—"}</dd>
        </div>
      </dl>

      <div
        role="note"
        className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400"
      >
        <p className="font-medium">Módulo pendiente de implementación</p>
        <p className="mt-1">
          La gestión de depósitos, usuarios y reglas requiere endpoints de escritura y un sistema
          de autenticación con roles, que todavía no existen en el backend. El tenant que se
          muestra arriba se resuelve del lado servidor, no desde el navegador.
        </p>
      </div>
    </div>
  );
}
