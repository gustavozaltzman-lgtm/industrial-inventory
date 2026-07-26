import { http, HttpResponse } from "msw";
import type { DeviceSnapshot, OperationsKpis, ReconciliationRow } from "@indinv/core-domain";

export const mockKpis: OperationsKpis = {
  windowMinutes: 60,
  generatedAt: "2026-07-26T12:00:00.000Z",
  throughputPerMinute: 2.5,
  avgSecondsBetweenReads: 24,
  avgIngestLatencyMs: 1800,
  totalEvents: 150,
  pendingSyncEvents: 12,
  failedSyncEvents: 3,
  duplicateEventsRejected: 7,
  barcodeErrorRate: 0.01,
  // null a propósito: verifica que la UI muestre "sin dato" y no 0.
  ocrErrorRate: null,
  eventsByCaptureSource: { ML_KIT_MOBILE: 120, ZEBRA_SCANNER: 30 },
};

export const mockDevices: DeviceSnapshot[] = [
  {
    deviceId: "zebra-tc22-0001",
    tenantId: "00000000-0000-0000-0000-000000000001",
    label: null,
    health: "online",
    batteryLevel: 0.82,
    isCharging: false,
    network: "wifi",
    pendingSyncCount: 0,
    lastSeenAt: "2026-07-26T11:59:00.000Z",
    lastSequenceNumber: 341,
  },
  {
    deviceId: "amr-robot-07",
    tenantId: "00000000-0000-0000-0000-000000000001",
    label: null,
    health: "degraded",
    batteryLevel: null,
    isCharging: null,
    network: "unknown",
    pendingSyncCount: 12,
    lastSeenAt: "2026-07-26T11:30:00.000Z",
    lastSequenceNumber: 88,
  },
];

export const mockReconciliation: ReconciliationRow[] = Array.from({ length: 250 }, (_, i) => ({
  skuId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  sku: `SKU-${1000 + i}`,
  description: `Producto de prueba ${i}`,
  locationCode: null,
  theoreticalQuantity: null,
  countedQuantity: i * 2,
  variance: null,
  lastCountedAt: "2026-07-26T11:00:00.000Z",
}));

/** Camino feliz. Los tests que necesiten fallos usan server.use(...). */
export const handlers = [
  http.get("/api/operations/kpis", () => HttpResponse.json(mockKpis)),
  http.get("/api/operations/devices", () => HttpResponse.json(mockDevices)),
  http.get("/api/operations/reconciliation", () => HttpResponse.json(mockReconciliation)),
];

export const errorHandlers = {
  kpisUnauthorized: http.get("/api/operations/kpis", () =>
    HttpResponse.json({ error: "No hay sesión activa", kind: "unauthorized" }, { status: 401 }),
  ),
  kpisTimeout: http.get("/api/operations/kpis", () =>
    HttpResponse.json(
      { error: "El backend no respondió a tiempo", kind: "timeout" },
      { status: 504 },
    ),
  ),
  kpisEmpty: http.get("/api/operations/kpis", () =>
    HttpResponse.json({ ...mockKpis, totalEvents: 0 }),
  ),
};
