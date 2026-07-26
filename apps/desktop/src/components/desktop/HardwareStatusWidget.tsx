"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  tauriBridge,
  type DbStats,
  type HardwareErrorEvent,
  type HardwareScanEvent,
  type SerialPortInfo,
} from "@/services/tauriBridge";

const STORAGE_WARNING_BYTES = 500 * 1024 * 1024; // 500 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

interface HardwareState {
  available: SerialPortInfo[];
  connected: string[];
  lastScan: HardwareScanEvent | null;
  lastError: HardwareErrorEvent | null;
  dbStats: DbStats | null;
}

/**
 * Barra de estado nativo: puertos serie conectados (balanzas, lectores de
 * mesa, impresoras ZPL) y salud del almacenamiento SQLite local.
 *
 * Fuera del runtime de Tauri (navegador normal, tests) `tauriBridge` degrada
 * a listas vacías en vez de lanzar, así que el widget renderiza igual —
 * solo muestra "sin hardware conectado".
 */
export const HardwareStatusWidget = memo(function HardwareStatusWidget() {
  const [state, setState] = useState<HardwareState>({
    available: [],
    connected: [],
    lastScan: null,
    lastError: null,
    dbStats: null,
  });

  const refreshPorts = useCallback(async () => {
    const [available, connected] = await Promise.all([
      tauriBridge.listSerialPorts(),
      tauriBridge.connectedSerialPorts(),
    ]);
    setState((current) => ({ ...current, available, connected }));
  }, []);

  const refreshDbStats = useCallback(async () => {
    if (!tauriBridge.isNative()) return;
    try {
      const dbStats = await tauriBridge.getDbStats();
      setState((current) => ({ ...current, dbStats }));
    } catch {
      // init_db puede no haber corrido todavía al montar; se reintenta en
      // el próximo intervalo en vez de mostrar un error permanente.
    }
  }, []);

  useEffect(() => {
    void refreshPorts();
    void refreshDbStats();

    const statsInterval = setInterval(() => void refreshDbStats(), 30_000);

    let disposed = false;
    const unlistenPromises = [
      tauriBridge.onHardwareScan((event) => {
        if (disposed) return;
        setState((current) => ({ ...current, lastScan: event }));
      }),
      tauriBridge.onHardwareError((event) => {
        if (disposed) return;
        setState((current) => ({ ...current, lastError: event }));
      }),
    ];

    return () => {
      disposed = true;
      clearInterval(statsInterval);
      for (const promise of unlistenPromises) void promise.then((unlisten) => unlisten());
    };
  }, [refreshPorts, refreshDbStats]);

  const connectPort = useCallback(
    async (portName: string) => {
      await tauriBridge.connectSerialPort(portName);
      await refreshPorts();
    },
    [refreshPorts],
  );

  if (!tauriBridge.isNative()) {
    return (
      <div role="status" className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground">
        Ejecutando en navegador — sin acceso a hardware nativo.
      </div>
    );
  }

  const storageTone =
    state.dbStats && state.dbStats.sizeBytes > STORAGE_WARNING_BYTES ? "text-amber-600" : "";

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-md border px-3 py-1.5 text-xs"
      aria-label="Estado de hardware local"
    >
      <span>
        Puertos: {state.connected.length}/{state.available.length}
      </span>

      {state.available.map((port) => {
        const isConnected = state.connected.includes(port.portName);
        return (
          <button
            key={port.portName}
            type="button"
            onClick={() => (isConnected ? undefined : void connectPort(port.portName))}
            className="rounded border px-2 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-pressed={isConnected}
          >
            {port.portName} {isConnected ? "●" : "○"}
          </button>
        );
      })}

      {state.dbStats && (
        <span className={storageTone}>
          SQLite: {formatBytes(state.dbStats.sizeBytes)} · {state.dbStats.pendingEvents} pend.
        </span>
      )}

      {state.lastScan && (
        <span aria-live="polite">
          Última lectura: {state.lastScan.raw} ({state.lastScan.portName})
        </span>
      )}

      {state.lastError && (
        <span role="alert" className="text-destructive">
          {state.lastError.portName}: {state.lastError.message}
        </span>
      )}
    </div>
  );
});
