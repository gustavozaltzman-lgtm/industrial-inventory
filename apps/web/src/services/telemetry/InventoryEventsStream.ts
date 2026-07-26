import { telemetryEventSchema, type TelemetryChannel, type TelemetryEvent } from "@indinv/core-domain";
import { TELEMETRY_STREAM_PATH } from "../apiClient";

export type ConnectionState = "connecting" | "open" | "closed";

export interface StreamListeners {
  onEvent: (event: TelemetryEvent) => void;
  onStateChange?: (state: ConnectionState) => void;
  /** Se invoca con eventos que no pasan la validación de esquema. */
  onInvalidEvent?: (raw: string, reason: string) => void;
}

const CHANNELS: readonly TelemetryChannel[] = [
  "scan_event",
  "heartbeat",
  "device_alert",
  "sync_error",
];

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

/**
 * Cliente SSE de telemetría.
 *
 * Usa EventSource nativo, que ya reconecta solo, pero se envuelve para poder
 * aplicar backoff propio: el reintento por defecto es agresivo y con varios
 * paneles abiertos golpearía al backend en bucle si está caído.
 *
 * No recibe ni acepta un tenantId: el stream apunta a un route handler de Next
 * que resuelve la identidad del lado servidor.
 */
export class InventoryEventsStream {
  private source: EventSource | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;

  constructor(private readonly listeners: StreamListeners) {}

  connect(): void {
    if (this.source) return;
    this.manuallyClosed = false;
    this.open();
  }

  private open(): void {
    this.listeners.onStateChange?.("connecting");
    const source = new EventSource(TELEMETRY_STREAM_PATH);
    this.source = source;

    source.onopen = () => {
      this.reconnectAttempt = 0;
      this.listeners.onStateChange?.("open");
    };

    // El backend etiqueta cada mensaje con su canal, así que se registra un
    // handler por canal en vez de un onmessage genérico.
    for (const channel of CHANNELS) {
      source.addEventListener(channel, (event) => {
        this.handleRaw((event as MessageEvent<string>).data);
      });
    }

    source.onerror = () => {
      // EventSource no distingue "caído" de "reconectando"; se cierra y se
      // reprograma con backoff para no dejarlo reintentar por su cuenta.
      source.close();
      this.source = null;
      this.listeners.onStateChange?.("closed");
      if (!this.manuallyClosed) this.scheduleReconnect();
    };
  }

  private handleRaw(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.listeners.onInvalidEvent?.(raw, "JSON inválido");
      return;
    }

    const result = telemetryEventSchema.safeParse(parsed);
    if (!result.success) {
      this.listeners.onInvalidEvent?.(raw, result.error.message);
      return;
    }

    this.listeners.onEvent(result.data);
  }

  private scheduleReconnect(): void {
    const delay = Math.min(BASE_RECONNECT_MS * 2 ** this.reconnectAttempt, MAX_RECONNECT_MS);
    const jitter = Math.random() * delay * 0.3;
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => this.open(), Math.round(delay - jitter));
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.source?.close();
    this.source = null;
    this.listeners.onStateChange?.("closed");
  }
}
