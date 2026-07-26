import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@/server/backendGateway";
import { toErrorResponse } from "@/server/routeHelpers";
import type { ReconciliationRow } from "@indinv/core-domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const warehouseId = request.nextUrl.searchParams.get("warehouseId");

  if (!warehouseId) {
    return NextResponse.json({ error: "warehouseId requerido", kind: "unknown" }, { status: 400 });
  }

  try {
    const rows = await callBackend<ReconciliationRow[]>({
      path: `/api/v1/operations/reconciliation?warehouseId=${warehouseId}`,
    });
    return NextResponse.json(rows);
  } catch (error) {
    return toErrorResponse(error);
  }
}
