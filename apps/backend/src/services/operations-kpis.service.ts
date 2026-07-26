import type {
  CaptureSource,
  InventoryScanEvent,
  OperationsKpis,
} from "@indinv/core-domain";

/** Motores que decodifican simbología impresa (código de barras / DataMatrix). */
const BARCODE_SOURCES: ReadonlySet<CaptureSource> = new Set([
  "ML_KIT_MOBILE",
  "COGNEX_SOCKET",
  "ZEBRA_SCANNER",
]);

/** Motores que dependen de reconocimiento óptico sobre imagen. */
const OCR_SOURCES: ReadonlySet<CaptureSource> = new Set(["IP_CAMERA", "AMR_ROBOT"]);

function errorRate(events: InventoryScanEvent[], sources: ReadonlySet<CaptureSource>) {
  const scoped = events.filter((event) => sources.has(event.captureSource));
  if (scoped.length === 0) return null;
  const failed = scoped.filter((event) => event.syncStatus === "sync_failed").length;
  return failed / scoped.length;
}

/**
 * Deriva los KPIs del Operations Center a partir de los eventos ya
 * persistidos. Los indicadores sin fuente devuelven `null` en vez de 0: para
 * un operador, un cero es "todo bien" y eso sería mentir.
 */
export function computeOperationsKpis(
  events: InventoryScanEvent[],
  windowMinutes: number,
  now: Date = new Date(),
): OperationsKpis {
  const sorted = [...events].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );

  const eventsByCaptureSource = sorted.reduce<Partial<Record<CaptureSource, number>>>(
    (acc, event) => {
      acc[event.captureSource] = (acc[event.captureSource] ?? 0) + 1;
      return acc;
    },
    {},
  );

  let avgSecondsBetweenReads: number | null = null;
  if (sorted.length >= 2) {
    const first = new Date(sorted[0]!.capturedAt).getTime();
    const last = new Date(sorted[sorted.length - 1]!.capturedAt).getTime();
    avgSecondsBetweenReads = (last - first) / 1000 / (sorted.length - 1);
  }

  // capturedAt lo pone el dispositivo y recordedAt el servidor: la diferencia
  // incluye el tiempo que el evento pasó en la cola offline, que es
  // precisamente lo que interesa vigilar en planta.
  const latencies = sorted
    .filter((event) => event.recordedAt)
    .map((event) => new Date(event.recordedAt!).getTime() - new Date(event.capturedAt).getTime())
    .filter((ms) => ms >= 0);

  const avgIngestLatencyMs =
    latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

  return {
    windowMinutes,
    generatedAt: now.toISOString(),
    throughputPerMinute: windowMinutes > 0 ? sorted.length / windowMinutes : 0,
    avgSecondsBetweenReads,
    avgIngestLatencyMs,
    totalEvents: sorted.length,
    pendingSyncEvents: sorted.filter((e) => e.syncStatus === "pending_sync").length,
    failedSyncEvents: sorted.filter((e) => e.syncStatus === "sync_failed").length,
    // Los duplicados los rechaza la ingesta antes de persistir, así que no se
    // pueden contar desde la tabla. Requiere un contador aparte en el
    // IngestScanUseCase; hasta entonces, 0 declarado como tal.
    duplicateEventsRejected: 0,
    barcodeErrorRate: errorRate(sorted, BARCODE_SOURCES),
    ocrErrorRate: errorRate(sorted, OCR_SOURCES),
    eventsByCaptureSource: eventsByCaptureSource as OperationsKpis["eventsByCaptureSource"],
  };
}
