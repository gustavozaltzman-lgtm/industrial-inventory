import { randomUUID, webcrypto } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DecodedScanResult,
  InventoryEventRepository,
  InventoryScanEvent,
} from "@indinv/core-domain";
import { CaptureEngine, UnknownBarcodeError, UnknownLocationError } from "../engine/CaptureEngine";
import type { CatalogResolver, Clock, SequenceProvider } from "../engine/ports";
import type { BarcodeEngineAdapter } from "../adapters/barcode/BarcodeEngineAdapter";
import type { DeviceAdapter } from "../adapters/device/DeviceAdapter";
import type { FeedbackAdapter } from "../adapters/feedback/FeedbackAdapter";

beforeAll(() => {
  // createStockReadEvent usa globalThis.crypto para ser runtime-agnostic;
  // en RN lo aporta expo-crypto, acá lo aporta node:crypto.
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto });
  }
});

const TENANT = randomUUID();
const WAREHOUSE = randomUUID();
const SKU = randomUUID();
const LOCATION = randomUUID();
const DEVICE_ID = "zebra-tc22-0001";
const FIXED_NOW = "2026-07-25T12:00:00.000Z";

class InMemoryRepository implements InventoryEventRepository {
  events: InventoryScanEvent[] = [];
  async append(event: InventoryScanEvent) {
    this.events.push(event);
  }
  async appendBatch(events: InventoryScanEvent[]) {
    this.events.push(...events);
  }
  async findExistingIds(tenantId: string, ids: string[]) {
    return new Set(
      this.events.filter((e) => e.tenantId === tenantId && ids.includes(e.id)).map((e) => e.id),
    );
  }
  async findById(tenantId: string, id: string) {
    return this.events.find((e) => e.tenantId === tenantId && e.id === id) ?? null;
  }
  async findByCorrelationId(tenantId: string, correlationId: string) {
    return this.events.filter((e) => e.tenantId === tenantId && e.correlationId === correlationId);
  }
  async findPendingSync(tenantId: string) {
    return this.events.filter((e) => e.tenantId === tenantId && e.syncStatus === "pending_sync");
  }
  async listByWarehouse(tenantId: string, warehouseId: string) {
    return this.events.filter((e) => e.tenantId === tenantId && e.warehouseId === warehouseId);
  }
}

function buildHarness(overrides: { catalog?: Partial<CatalogResolver> } = {}) {
  const repository = new InMemoryRepository();

  let seq = 0;
  const sequence: SequenceProvider = { next: vi.fn(async () => ++seq) };

  const barcodeEngine: BarcodeEngineAdapter = {
    engineName: "TEST_ENGINE",
    processFrame: vi.fn(async (): Promise<DecodedScanResult[]> => []),
    scanFromBuffer: vi.fn(async (): Promise<DecodedScanResult[]> => []),
  };

  const device = {
    getDeviceId: vi.fn(async () => DEVICE_ID),
    getBatteryStatus: vi.fn(),
    getNetworkStatus: vi.fn(),
    onNetworkChange: vi.fn(() => () => {}),
    hasCameraPermission: vi.fn(),
    requestCameraPermission: vi.fn(),
    toggleFlash: vi.fn(),
    isFlashOn: vi.fn(() => false),
  } as unknown as DeviceAdapter;

  const feedback: FeedbackAdapter = {
    success: vi.fn(async () => {}),
    error: vi.fn(async () => {}),
    warning: vi.fn(async () => {}),
  };

  const catalog: CatalogResolver = {
    resolveSkuByBarcode: vi.fn(async () => SKU),
    resolveLocationByCode: vi.fn(async () => LOCATION),
    ...overrides.catalog,
  };

  const clock: Clock = { nowIso: () => FIXED_NOW };

  const engine = new CaptureEngine({
    barcodeEngine,
    repository,
    device,
    feedback,
    sequence,
    catalog,
    clock,
  });

  return { engine, repository, feedback, sequence, catalog, device };
}

const baseInput = {
  tenantId: TENANT,
  warehouseId: WAREHOUSE,
  barcode: "7790001",
  quantity: 3,
  captureSource: "ML_KIT_MOBILE" as const,
};

describe("CaptureEngine", () => {
  let harness: ReturnType<typeof buildHarness>;

  beforeEach(() => {
    harness = buildHarness();
  });

  it("persiste el evento en la base local antes de cualquier intento de red", async () => {
    const event = await harness.engine.captureScan(baseInput);

    expect(harness.repository.events).toHaveLength(1);
    expect(harness.repository.events[0]?.id).toBe(event.id);
    expect(event.syncStatus).toBe("pending_sync");
  });

  it("resuelve el catálogo y arma un evento de dominio válido", async () => {
    const event = await harness.engine.captureScan({ ...baseInput, locationCode: "A-01-02" });

    expect(event.skuId).toBe(SKU);
    expect(event.locationId).toBe(LOCATION);
    expect(event.quantity).toBe(3);
    expect(event.capturedAt).toBe(FIXED_NOW);
    expect(event.metadata).toMatchObject({ barcode: "7790001", engine: "TEST_ENGINE" });
  });

  it("asigna metadatos de idempotencia: id único, deviceId y secuencia monotónica", async () => {
    const first = await harness.engine.captureScan(baseInput);
    const second = await harness.engine.captureScan(baseInput);

    expect(first.id).not.toBe(second.id);
    expect(first.deviceId).toBe(DEVICE_ID);
    expect(second.deviceId).toBe(DEVICE_ID);
    expect(first.sequenceNumber).toBe(1);
    expect(second.sequenceNumber).toBe(2);
  });

  it("emite el evento inmutable a los suscriptores", async () => {
    const listener = vi.fn();
    const unsubscribe = harness.engine.subscribe(listener);

    const event = await harness.engine.captureScan(baseInput);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(event);
    expect(Object.isFrozen(event)).toBe(true);

    unsubscribe();
    await harness.engine.captureScan(baseInput);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("da feedback de éxito al capturar", async () => {
    await harness.engine.captureScan(baseInput);

    expect(harness.feedback.success).toHaveBeenCalledTimes(1);
    expect(harness.feedback.error).not.toHaveBeenCalled();
  });

  it("rechaza un código ausente del catálogo sin persistir nada", async () => {
    const h = buildHarness({ catalog: { resolveSkuByBarcode: vi.fn(async () => null) } });

    await expect(h.engine.captureScan(baseInput)).rejects.toBeInstanceOf(UnknownBarcodeError);
    expect(h.repository.events).toHaveLength(0);
    expect(h.feedback.error).toHaveBeenCalledTimes(1);
  });

  it("rechaza una ubicación desconocida sin persistir nada", async () => {
    const h = buildHarness({ catalog: { resolveLocationByCode: vi.fn(async () => null) } });

    await expect(
      h.engine.captureScan({ ...baseInput, locationCode: "NO-EXISTE" }),
    ).rejects.toBeInstanceOf(UnknownLocationError);
    expect(h.repository.events).toHaveLength(0);
    expect(h.feedback.error).toHaveBeenCalledTimes(1);
  });

  it("no consume número de secuencia si el catálogo falla", async () => {
    const h = buildHarness({ catalog: { resolveSkuByBarcode: vi.fn(async () => null) } });

    await expect(h.engine.captureScan(baseInput)).rejects.toThrow();
    expect(h.sequence.next).not.toHaveBeenCalled();
  });
});
