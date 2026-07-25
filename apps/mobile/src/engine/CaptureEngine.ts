import {
  createStockReadEvent,
  type CaptureSource,
  type DecodedScanResult,
  type InventoryEventRepository,
  type InventoryScanEvent,
} from "@indinv/core-domain";
import type { BarcodeEngineAdapter, CameraFrame } from "../adapters/barcode/BarcodeEngineAdapter.js";
import type { DeviceAdapter } from "../adapters/device/DeviceAdapter.js";
import type { FeedbackAdapter } from "../adapters/feedback/FeedbackAdapter.js";
import {
  systemClock,
  type CaptureListener,
  type CatalogResolver,
  type Clock,
  type SequenceProvider,
} from "./ports.js";

export class UnknownBarcodeError extends Error {
  constructor(barcode: string) {
    super(`El código ${barcode} no existe en el catálogo del tenant`);
    this.name = "UnknownBarcodeError";
  }
}

export class UnknownLocationError extends Error {
  constructor(code: string) {
    super(`La ubicación ${code} no existe en el catálogo del tenant`);
    this.name = "UnknownLocationError";
  }
}

export interface CaptureEngineDeps {
  barcodeEngine: BarcodeEngineAdapter;
  repository: InventoryEventRepository;
  device: DeviceAdapter;
  feedback: FeedbackAdapter;
  sequence: SequenceProvider;
  catalog: CatalogResolver;
  clock?: Clock;
}

export interface CaptureScanInput {
  tenantId: string;
  warehouseId: string;
  barcode: string;
  quantity: number;
  captureSource: CaptureSource;
  locationCode?: string;
  operatorId?: string;
  correlationId?: string;
  imageRef?: string;
}

/**
 * Orquestador de captura. Su responsabilidad es una sola: tomar una lectura
 * ya decodificada y convertirla en un InventoryScanEvent válido, persistido
 * localmente antes de cualquier intento de red (offline-first estricto).
 *
 * No conoce React, ni la cámara, ni HTTP. Todo lo que necesita entra por
 * puertos, lo que lo vuelve testeable sin runtime de React Native.
 */
export class CaptureEngine {
  private readonly clock: Clock;
  private readonly listeners = new Set<CaptureListener>();

  constructor(private readonly deps: CaptureEngineDeps) {
    this.clock = deps.clock ?? systemClock;
  }

  /** Delega en el motor de lectura; existe para que la UI no lo importe. */
  processFrame(frame: CameraFrame): Promise<DecodedScanResult[]> {
    return this.deps.barcodeEngine.processFrame(frame);
  }

  subscribe(listener: CaptureListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Flujo completo de una captura:
   *   resolver catálogo -> asignar metadatos de idempotencia -> validar en el
   *   dominio -> persistir local como pending_sync -> feedback -> notificar.
   *
   * Si algo falla, emite feedback de error y propaga: el llamador decide la
   * transición de la máquina de estados.
   */
  async captureScan(input: CaptureScanInput): Promise<InventoryScanEvent> {
    try {
      const skuId = await this.deps.catalog.resolveSkuByBarcode(input.tenantId, input.barcode);
      if (!skuId) throw new UnknownBarcodeError(input.barcode);

      let locationId: string | undefined;
      if (input.locationCode) {
        const resolved = await this.deps.catalog.resolveLocationByCode(
          input.tenantId,
          input.locationCode,
        );
        if (!resolved) throw new UnknownLocationError(input.locationCode);
        locationId = resolved;
      }

      const deviceId = await this.deps.device.getDeviceId();
      const sequenceNumber = await this.deps.sequence.next(deviceId);

      // createStockReadEvent genera el `id` (clave de idempotencia con la que
      // el backend deduplica) y congela el evento: inmutable desde su origen.
      const event = createStockReadEvent({
        tenantId: input.tenantId,
        warehouseId: input.warehouseId,
        skuId,
        locationId,
        quantity: input.quantity,
        captureSource: input.captureSource,
        capturedAt: this.clock.nowIso(),
        deviceId,
        sequenceNumber,
        operatorId: input.operatorId,
        correlationId: input.correlationId,
        imageRef: input.imageRef,
        metadata: { barcode: input.barcode, engine: this.deps.barcodeEngine.engineName },
      });

      await this.deps.repository.append(event);

      await this.deps.feedback.success();
      this.emit(event);
      return event;
    } catch (error) {
      await this.deps.feedback.error();
      throw error;
    }
  }

  private emit(event: InventoryScanEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
