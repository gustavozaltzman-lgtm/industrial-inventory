import "server-only";
import { NextResponse } from "next/server";
import { BackendError } from "./backendGateway";
import { UnauthorizedError } from "./session";

export interface ApiErrorBody {
  error: string;
  kind: "unauthorized" | "timeout" | "backend" | "unknown";
}

/**
 * Traduce los errores del gateway a respuestas HTTP con una forma estable,
 * para que el cliente pueda distinguir "no autorizado" de "el backend estaba
 * dormido" sin parsear mensajes de texto.
 */
export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message, kind: "unauthorized" }, { status: 401 });
  }

  if (error instanceof BackendError) {
    return NextResponse.json(
      { error: error.message, kind: error.isTimeout ? "timeout" : "backend" },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Error desconocido", kind: "unknown" },
    { status: 500 },
  );
}
