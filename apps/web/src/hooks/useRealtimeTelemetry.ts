"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TelemetryEvent } from "@indinv/core-domain";
import {
  InventoryEventsStream,
  type ConnectionState,
} from "@/services/telemetry/InventoryEventsStream";
import { queryKeys } from "./queryKeys";

const FEED_LIMIT = 100;

export interface RealtimeTelemetry {
  connection: ConnectionState;
  /** Últimos eventos recibidos, más nuevo primero. Acotado a FEED_LIMIT. */
  feed: TelemetryEvent[];
}

/**
 * Puente entre el stream SSE y el cache de TanStack Query.
 *
 * En vez de reescribir el cache a mano con los datos del evento (que llevaría
 * a que el panel muestre agregados calculados en el cliente, divergentes de
 * los del servidor), invalida las queries afectadas y deja que Query
 * refetchee. El evento dice *qué* cambió; el servidor sigue siendo la única
 * fuente de verdad de *cuánto*.
 *
 * Las invalidaciones se agrupan en una ventana corta porque una ráfaga de
 * escaneos (un operario contando rápido) dispararía un refetch por evento.
 */
export function useRealtimeTelemetry(warehouseId: string, windowMinutes = 60): RealtimeTelemetry {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [feed, setFeed] = useState<TelemetryEvent[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKeys = useRef(new Set<string>());

  const keys = useMemo(
    () => ({
      kpis: queryKeys.operationsKpis(warehouseId, windowMinutes),
      devices: queryKeys.deviceFleet(warehouseId),
      reconciliation: queryKeys.reconciliation(warehouseId),
    }),
    [warehouseId, windowMinutes],
  );

  useEffect(() => {
    const scheduleInvalidation = (which: keyof typeof keys) => {
      pendingKeys.current.add(which);
      if (flushTimer.current) return;

      flushTimer.current = setTimeout(() => {
        for (const key of pendingKeys.current) {
          void queryClient.invalidateQueries({ queryKey: keys[key as keyof typeof keys] });
        }
        pendingKeys.current.clear();
        flushTimer.current = null;
      }, 750);
    };

    const stream = new InventoryEventsStream({
      onStateChange: setConnection,
      onEvent: (event) => {
        setFeed((current) => [event, ...current].slice(0, FEED_LIMIT));

        switch (event.channel) {
          case "scan_event":
            scheduleInvalidation("kpis");
            scheduleInvalidation("reconciliation");
            scheduleInvalidation("devices");
            break;
          case "heartbeat":
          case "device_alert":
            scheduleInvalidation("devices");
            break;
          case "sync_error":
            scheduleInvalidation("kpis");
            scheduleInvalidation("devices");
            break;
        }
      },
      onInvalidEvent: (_raw, reason) => {
        // Un evento malformado no debe tumbar el panel; queda registrado y se
        // sigue consumiendo el stream.
        console.warn("[telemetry] evento descartado:", reason);
      },
    });

    stream.connect();

    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = null;
      stream.close();
    };
  }, [queryClient, keys]);

  return { connection, feed };
}
