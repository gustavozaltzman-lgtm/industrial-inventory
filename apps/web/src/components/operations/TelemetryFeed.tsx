"use client";

import { memo } from "react";
import type { TelemetryEvent } from "@indinv/core-domain";
import type { ConnectionState } from "@/services/telemetry/InventoryEventsStream";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connecting: "Conectando…",
  open: "En vivo",
  closed: "Desconectado",
};

const CONNECTION_VARIANT: Record<ConnectionState, NonNullable<BadgeProps["variant"]>> = {
  connecting: "warning",
  open: "success",
  closed: "destructive",
};

function describe(event: TelemetryEvent): string {
  switch (event.channel) {
    case "scan_event":
      return `${event.payload.quantity} u. · ${event.payload.captureSource}`;
    case "heartbeat":
      return `${event.payload.deviceId} · batería ${Math.round(event.payload.batteryLevel * 100)}%`;
    case "device_alert":
      return `${event.payload.severity.toUpperCase()} · ${event.payload.message}`;
    case "sync_error":
      return `${event.payload.failedEventIds.length} eventos fallaron · ${event.payload.reason}`;
  }
}

const FeedRow = memo(function FeedRow({ event }: { event: TelemetryEvent }) {
  return (
    <li className="flex items-baseline gap-2 border-b px-3 py-2 text-sm last:border-0">
      <time
        className="shrink-0 text-xs tabular-nums text-muted-foreground"
        dateTime={event.emittedAt}
      >
        {new Date(event.emittedAt).toLocaleTimeString()}
      </time>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{event.channel}</span>
      <span className="truncate">{describe(event)}</span>
    </li>
  );
});

export function TelemetryFeed({
  feed,
  connection,
}: {
  feed: TelemetryEvent[];
  connection: ConnectionState;
}) {
  return (
    <section aria-label="Feed de telemetría en vivo" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Telemetría en vivo</h2>
        <Badge variant={CONNECTION_VARIANT[connection]}>{CONNECTION_LABEL[connection]}</Badge>
      </div>

      {feed.length === 0 ? (
        <p
          className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {connection === "open"
            ? "Conectado. Esperando eventos…"
            : "Sin conexión al stream de telemetría."}
        </p>
      ) : (
        // aria-live polite: los eventos llegan en ráfaga y anunciarlos de
        // forma assertive interrumpiría al lector de pantalla sin parar.
        <ul
          className="max-h-64 overflow-auto rounded-lg border"
          aria-live="polite"
          aria-relevant="additions"
        >
          {feed.map((event, index) => (
            <FeedRow key={`${event.emittedAt}-${index}`} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}
