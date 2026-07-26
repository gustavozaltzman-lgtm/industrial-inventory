import type { DeviceHealth, DeviceSnapshot, InventoryScanEvent } from "@indinv/core-domain";

const DEGRADED_AFTER_MS = 15 * 60_000;
const OFFLINE_AFTER_MS = 60 * 60_000;

function healthFromLastSeen(lastSeen: Date, now: Date): DeviceHealth {
  const elapsed = now.getTime() - lastSeen.getTime();
  if (elapsed > OFFLINE_AFTER_MS) return "offline";
  if (elapsed > DEGRADED_AFTER_MS) return "degraded";
  return "online";
}

/**
 * Reconstruye el estado de la flota a partir de los eventos de escaneo, que
 * hoy son la única señal persistida que emiten los equipos.
 *
 * LIMITACIÓN CONOCIDA: no existe tabla de heartbeats, así que batería,
 * conectividad y cola pendiente NO se pueden derivar de acá y se devuelven
 * como `null` / 0 en lugar de inventarlos. El panel los muestra como "sin
 * dato". Para poblarlos hace falta que el móvil emita heartbeats y que el
 * backend los persista; ahí esta función pasa a leer esa tabla y la interfaz
 * pública no cambia.
 */
export function buildDeviceSnapshots(
  tenantId: string,
  events: InventoryScanEvent[],
  now: Date = new Date(),
): DeviceSnapshot[] {
  const byDevice = new Map<string, InventoryScanEvent[]>();

  for (const event of events) {
    if (!event.deviceId) continue;
    const bucket = byDevice.get(event.deviceId);
    if (bucket) bucket.push(event);
    else byDevice.set(event.deviceId, [event]);
  }

  return [...byDevice.entries()]
    .map(([deviceId, deviceEvents]) => {
      const timestamps = deviceEvents.map((e) => new Date(e.capturedAt).getTime());
      const lastSeen = new Date(Math.max(...timestamps));
      const sequences = deviceEvents
        .map((e) => e.sequenceNumber)
        .filter((s): s is number => typeof s === "number");

      return {
        deviceId,
        tenantId,
        label: null,
        health: healthFromLastSeen(lastSeen, now),
        batteryLevel: null,
        isCharging: null,
        network: "unknown" as const,
        pendingSyncCount: deviceEvents.filter((e) => e.syncStatus === "pending_sync").length,
        lastSeenAt: lastSeen.toISOString(),
        lastSequenceNumber: sequences.length > 0 ? Math.max(...sequences) : null,
      };
    })
    .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""));
}
