"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, Lock, RefreshCw } from "lucide-react";
import { ApiError } from "@/services/apiClient";
import { Button } from "@/components/ui/button";

export interface StateBoundaryProps<T> {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  /** Se considera vacío si devuelve true; por defecto, un array de largo 0. */
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  /** Nombre del módulo, para que los mensajes digan qué falló. */
  label: string;
  children: (data: T) => ReactNode;
}

function defaultIsEmpty<T>(data: T): boolean {
  return Array.isArray(data) && data.length === 0;
}

function Shell({
  children,
  tone = "neutral",
  live = "polite",
}: {
  children: ReactNode;
  tone?: "neutral" | "danger";
  live?: "polite" | "assertive";
}) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div
      role="status"
      aria-live={live}
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border p-8 text-center text-sm ${toneClass}`}
    >
      {children}
    </div>
  );
}

/**
 * Render-prop que unifica los cuatro estados obligatorios de cada módulo.
 *
 * Accesibilidad: cada estado se anuncia por `role="status"` con `aria-live`,
 * de modo que un lector de pantalla informe el cambio sin que el operador
 * tenga que ir a buscarlo. Los errores usan `assertive` porque interrumpen la
 * tarea; el resto, `polite`. Los íconos van con `aria-hidden` — el texto ya
 * comunica el estado, repetirlo sería ruido.
 */
export function StateBoundary<T>({
  isLoading,
  error,
  data,
  isEmpty = defaultIsEmpty,
  onRetry,
  emptyMessage,
  label,
  children,
}: StateBoundaryProps<T>) {
  if (isLoading) {
    return (
      <Shell>
        <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
        <p>Cargando {label}…</p>
      </Shell>
    );
  }

  if (error) {
    const isUnauthorized = error instanceof ApiError && error.kind === "unauthorized";

    if (isUnauthorized) {
      return (
        <Shell tone="danger" live="assertive">
          <Lock aria-hidden className="h-5 w-5" />
          <div>
            <p className="font-medium">Sin permisos para ver {label}</p>
            <p className="mt-1">Tu sesión no tiene acceso a este módulo.</p>
          </div>
        </Shell>
      );
    }

    const isTimeout = error instanceof ApiError && error.kind === "timeout";
    const message = error instanceof Error ? error.message : "Error desconocido";

    return (
      <Shell tone="danger" live="assertive">
        <AlertTriangle aria-hidden className="h-5 w-5" />
        <div>
          <p className="font-medium">
            {isTimeout ? "El backend no respondió a tiempo" : `No se pudo cargar ${label}`}
          </p>
          <p className="mt-1">
            {isTimeout ? "Si estuvo inactivo, se está despertando: reintentá en un minuto." : message}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        )}
      </Shell>
    );
  }

  if (data === undefined || isEmpty(data)) {
    return (
      <Shell>
        <Inbox aria-hidden className="h-5 w-5" />
        <p>{emptyMessage ?? `Sin datos de ${label} todavía.`}</p>
      </Shell>
    );
  }

  return <>{children(data)}</>;
}
