"use client";

import { memo, useCallback } from "react";
import { BatteryWarning, Signal, SignalLow, SignalZero } from "lucide-react";
import type { DeviceHealth, DeviceSnapshot } from "@indinv/core-domain";
import { useDeviceFleet } from "@/hooks/useOperations";
import { StateBoundary } from "@/components/common/StateBoundary";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const HEALTH_VARIANT: Record<DeviceHealth, NonNullable<BadgeProps["variant"]>> = {
  online: "success",
  degraded: "warning",
  offline: "destructive",
};

const HEALTH_LABEL: Record<DeviceHealth, string> = {
  online: "En línea",
  degraded: "Degradado",
  offline: "Fuera de línea",
};

function HealthIcon({ health }: { health: DeviceHealth }) {
  const Icon = health === "online" ? Signal : health === "degraded" ? SignalLow : SignalZero;
  return <Icon aria-hidden className="h-4 w-4" />;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "nunca";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

const DeviceRow = memo(function DeviceRow({ device }: { device: DeviceSnapshot }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-0">
      <div className="flex min-w-0 items-center gap-2">
        <HealthIcon health={device.health} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{device.label ?? device.deviceId}</p>
          <p className="text-xs text-muted-foreground">
            Visto {formatLastSeen(device.lastSeenAt)}
            {device.lastSequenceNumber !== null && ` · seq #${device.lastSequenceNumber}`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {device.batteryLevel === null ? (
          <span
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title="El equipo aún no reporta heartbeats"
          >
            <BatteryWarning aria-hidden className="h-3.5 w-3.5" />
            sin dato
          </span>
        ) : (
          <span className="text-xs tabular-nums">{Math.round(device.batteryLevel * 100)}%</span>
        )}

        {device.pendingSyncCount > 0 && (
          <Badge variant="warning">{device.pendingSyncCount} pend.</Badge>
        )}

        <Badge variant={HEALTH_VARIANT[device.health]}>{HEALTH_LABEL[device.health]}</Badge>
      </div>
    </li>
  );
});

export function DeviceFleetStatus({ warehouseId }: { warehouseId: string }) {
  const { data, isLoading, error, refetch } = useDeviceFleet(warehouseId);
  const onRetry = useCallback(() => void refetch(), [refetch]);

  return (
    <StateBoundary
      label="la flota de dispositivos"
      isLoading={isLoading}
      error={error}
      data={data}
      emptyMessage="Ningún equipo reportó actividad en las últimas 24 horas."
      onRetry={onRetry}
    >
      {(devices) => (
        <ul className="rounded-lg border" aria-label="Estado de la flota de dispositivos">
          {devices.map((device) => (
            <DeviceRow key={device.deviceId} device={device} />
          ))}
        </ul>
      )}
    </StateBoundary>
  );
}
