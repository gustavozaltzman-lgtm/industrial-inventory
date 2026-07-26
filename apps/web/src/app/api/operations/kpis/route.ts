import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/server/backendGateway";
import { toErrorResponse } from "@/server/routeHelpers";
import type { OperationsKpis } from "@indinv/core-domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const warehouseId = request.nextUrl.searchParams.get("warehouseId");
  const windowMinutes = request.nextUrl.searchParams.get("windowMinutes") ?? "60";

  if (!warehouseId) {
    return NextResponse.json({ error: "warehouseId requerido", kind: "unknown" }, { status: 400 });
  }

  try {
    // Nótese que no se reenvía ningún header del cliente: el gateway resuelve
    // el tenant desde la sesión del servidor.
    const kpis = await callBackend<OperationsKpis>({
      path: `/api/v1/operations/kpis?warehouseId=${warehouseId}&windowMinutes=${windowMinutes}`,
    });
    return NextResponse.json(kpis);
  } catch (error) {
    return toErrorResponse(error);
  }
}
