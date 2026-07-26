"use client";

import { useCallback } from "react";
import type { OperationsKpis } from "@indinv/core-domain";
import { useOperationsKpis } from "@/hooks/useOperations";
import { StateBoundary } from "@/components/common/StateBoundary";
import { KpiCard } from "./KpiCard";

export interface OperationsKpiGridProps {
  warehouseId: string;
  windowMinutes?: number;
}

/** Una tasa de error por encima de esto amerita mirar el equipo. */
const ERROR_RATE_WARNING = 0.02;

function errorTone(rate: number | null) {
  if (rate === null) return "neutral" as const;
  if (rate >= ERROR_RATE_WARNING * 5) return "danger" as const;
  if (rate >= ERROR_RATE_WARNING) return "warning" as const;
  return "success" as const;
}

function Grid({ kpis }: { kpis: OperationsKpis }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="group"
      aria-label={`Indicadores de los últimos ${kpis.windowMinutes} minutos`}
    >
      <KpiCard
        label="Throughput"
        value={kpis.throughputPerMinute}
        unit="ev/min"
        precision={1}
        hint={`${kpis.totalEvents} eventos en ${kpis.windowMinutes} min`}
      />
      <KpiCard
        label="Tiempo entre lecturas"
        value={kpis.avgSecondsBetweenReads}
        unit="s"
        precision={1}
        hint="Promedio entre capturas consecutivas"
      />
      <KpiCard
        label="Latencia de ingesta"
        value={kpis.avgIngestLatencyMs}
        unit="ms"
        hint="Desde la captura hasta el registro en servidor"
        tone={
          kpis.avgIngestLatencyMs !== null && kpis.avgIngestLatencyMs > 60_000
            ? "warning"
            : "neutral"
        }
      />
      <KpiCard
        label="Pendientes de sync"
        value={kpis.pendingSyncEvents}
        hint="Eventos aún no confirmados"
        tone={kpis.pendingSyncEvents > 0 ? "warning" : "success"}
      />
      <KpiCard
        label="Error barcode"
        value={kpis.barcodeErrorRate === null ? null : kpis.barcodeErrorRate * 100}
        unit="%"
        precision={2}
        hint="ML Kit, Cognex y Zebra"
        tone={errorTone(kpis.barcodeErrorRate)}
      />
      <KpiCard
        label="Error OCR"
        value={kpis.ocrErrorRate === null ? null : kpis.ocrErrorRate * 100}
        unit="%"
        precision={2}
        hint="Cámaras IP y robots AMR"
        tone={errorTone(kpis.ocrErrorRate)}
      />
      <KpiCard
        label="Fallos de sync"
        value={kpis.failedSyncEvents}
        hint="Agotaron los reintentos"
        tone={kpis.failedSyncEvents > 0 ? "danger" : "success"}
      />
      <KpiCard
        label="Duplicados rechazados"
        value={kpis.duplicateEventsRejected}
        hint="Descartados por la ingesta idempotente"
      />
    </div>
  );
}

export function OperationsKpiGrid({ warehouseId, windowMinutes = 60 }: OperationsKpiGridProps) {
  const { data, isLoading, error, refetch } = useOperationsKpis(warehouseId, windowMinutes);
  const onRetry = useCallback(() => void refetch(), [refetch]);

  return (
    <StateBoundary
      label="los indicadores"
      isLoading={isLoading}
      error={error}
      data={data}
      isEmpty={(kpis) => kpis.totalEvents === 0}
      emptyMessage="No hubo actividad en la ventana seleccionada."
      onRetry={onRetry}
    >
      {(kpis) => <Grid kpis={kpis} />}
    </StateBoundary>
  );
}
