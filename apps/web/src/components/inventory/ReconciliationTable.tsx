"use client";

import { useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ReconciliationRow } from "@indinv/core-domain";
import { useReconciliation } from "@/hooks/useOperations";
import { StateBoundary } from "@/components/common/StateBoundary";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 44;
const OVERSCAN = 8;

function VarianceCell({ variance }: { variance: number | null }) {
  if (variance === null) {
    return (
      <span className="text-muted-foreground" title="Sin stock teórico cargado">
        —
      </span>
    );
  }
  const tone =
    variance === 0
      ? "text-emerald-600 dark:text-emerald-400"
      : variance < 0
        ? "text-destructive"
        : "text-amber-600 dark:text-amber-400";
  return (
    <span className={cn("tabular-nums font-medium", tone)}>
      {variance > 0 ? `+${variance}` : variance}
    </span>
  );
}

function VirtualRows({ rows }: { rows: ReconciliationRow[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  return (
    <div className="rounded-lg border">
      <div
        className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"
        role="row"
      >
        <span role="columnheader">SKU</span>
        <span role="columnheader" className="text-right">
          Teórico
        </span>
        <span role="columnheader" className="text-right">
          Contado
        </span>
        <span role="columnheader" className="text-right">
          Diferencia
        </span>
      </div>

      {/* La virtualización necesita un contenedor con alto fijo y scroll propio. */}
      <div
        ref={parentRef}
        className="max-h-[420px] overflow-auto"
        role="table"
        aria-label="Conciliación de inventario"
        aria-rowcount={rows.length}
        tabIndex={0}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]!;
            return (
              <div
                key={row.skuId}
                role="row"
                aria-rowindex={virtualRow.index + 1}
                className="absolute left-0 top-0 grid w-full grid-cols-[2fr_1fr_1fr_1fr] items-center gap-2 border-b px-3 text-sm"
                style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
              >
                <span role="cell" className="truncate">
                  <span className="font-medium">{row.sku}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{row.description}</span>
                </span>
                <span role="cell" className="text-right tabular-nums text-muted-foreground">
                  {row.theoreticalQuantity ?? "—"}
                </span>
                <span role="cell" className="text-right tabular-nums">
                  {row.countedQuantity}
                </span>
                <span role="cell" className="text-right">
                  <VarianceCell variance={row.variance} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ReconciliationTable({ warehouseId }: { warehouseId: string }) {
  const { data, isLoading, error, refetch } = useReconciliation(warehouseId);
  const onRetry = useCallback(() => void refetch(), [refetch]);

  return (
    <StateBoundary
      label="la conciliación"
      isLoading={isLoading}
      error={error}
      data={data}
      emptyMessage="No hay posiciones contadas en este depósito."
      onRetry={onRetry}
    >
      {(rows) => <VirtualRows rows={rows} />}
    </StateBoundary>
  );
}
