import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface SerialPortInfo {
  portName: string;
  kind: string;
}

export interface HardwareScanEvent {
  portName: string;
  raw: string;
  receivedAtMs: number;
}

export interface HardwareErrorEvent {
  portName: string;
  message: string;
}

export interface DbStats {
  path: string;
  sizeBytes: number;
  pendingEvents: number;
  capturedPhotos: number;
}

/** camelCase en TS, snake_case en el struct de Rust (convención serde). */
interface RustSerialPortInfo {
  port_name: string;
  kind: string;
}
interface RustHardwareScanEvent {
  port_name: string;
  raw: string;
  received_at_ms: number;
}
interface RustHardwareErrorEvent {
  port_name: string;
  message: string;
}
interface RustDbStats {
  path: string;
  size_bytes: number;
  pending_events: number;
  captured_photos: number;
}

function toPortInfo(r: RustSerialPortInfo): SerialPortInfo {
  return { portName: r.port_name, kind: r.kind };
}
function toScanEvent(r: RustHardwareScanEvent): HardwareScanEvent {
  return { portName: r.port_name, raw: r.raw, receivedAtMs: r.received_at_ms };
}
function toErrorEvent(r: RustHardwareErrorEvent): HardwareErrorEvent {
  return { portName: r.port_name, message: r.message };
}
function toDbStats(r: RustDbStats): DbStats {
  return {
    path: r.path,
    sizeBytes: r.size_bytes,
    pendingEvents: r.pending_events,
    capturedPhotos: r.captured_photos,
  };
}

/**
 * Adaptador Tauri ↔ navegador. Todo el resto de la app (incluido el
 * Operations Center reutilizado de @indinv/web) consume este módulo y nunca
 * `window.__TAURI__` directamente, de modo que el mismo código compila y
 * corre tanto empaquetado en el ejecutable nativo como en un navegador
 * normal durante el desarrollo — con las capacidades de hardware
 * simplemente ausentes en el segundo caso.
 */
export const tauriBridge = {
  isNative(): boolean {
    return isTauri();
  },

  async listSerialPorts(): Promise<SerialPortInfo[]> {
    if (!this.isNative()) return [];
    const ports = await invoke<RustSerialPortInfo[]>("list_serial_ports");
    return ports.map(toPortInfo);
  },

  async connectSerialPort(portName: string, baudRate?: number): Promise<void> {
    if (!this.isNative()) {
      throw new Error("connectSerialPort no está disponible fuera de la app de escritorio");
    }
    await invoke("connect_serial_port", { portName, baudRate });
  },

  async disconnectSerialPort(portName: string): Promise<void> {
    if (!this.isNative()) return;
    await invoke("disconnect_serial_port", { portName });
  },

  async connectedSerialPorts(): Promise<string[]> {
    if (!this.isNative()) return [];
    return invoke<string[]>("connected_serial_ports");
  },

  onHardwareScan(handler: (event: HardwareScanEvent) => void): Promise<UnlistenFn> {
    if (!this.isNative()) return Promise.resolve(() => {});
    return listen<RustHardwareScanEvent>("hardware-scan", (event) =>
      handler(toScanEvent(event.payload)),
    );
  },

  onHardwareError(handler: (event: HardwareErrorEvent) => void): Promise<UnlistenFn> {
    if (!this.isNative()) return Promise.resolve(() => {});
    return listen<RustHardwareErrorEvent>("hardware-error", (event) =>
      handler(toErrorEvent(event.payload)),
    );
  },

  async initDb(): Promise<string> {
    if (!this.isNative()) {
      throw new Error("initDb no está disponible fuera de la app de escritorio");
    }
    return invoke<string>("init_db");
  },

  async getDbStats(): Promise<DbStats> {
    if (!this.isNative()) {
      throw new Error("getDbStats no está disponible fuera de la app de escritorio");
    }
    const stats = await invoke<RustDbStats>("get_db_stats");
    return toDbStats(stats);
  },

  async vacuumDb(): Promise<void> {
    if (!this.isNative()) return;
    await invoke("vacuum_db");
  },
};

export type TauriBridge = typeof tauriBridge;
