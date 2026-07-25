import { CaptureSource } from "../schemas/inventory-scan-event.schema.js";
import { NewStockReadInput } from "../events/inventory-scan-event.js";

/**
 * Payload crudo tal como llega desde cualquier dispositivo de ingesta
 * (socket TCP de un Cognex, HTTP de un escáner Zebra, stream de una cámara
 * IP o un robot AMR). Cada adaptador de infraestructura produce esta forma.
 */
export interface ScanIngestPayload {
  source: CaptureSource;
  tenantId: string;
  warehouseId: string;
  skuIdentifier: string;
  quantity: number;
  timestamp: string;
  locationIdentifier?: string;
  deviceId?: string;
  rawMetadata?: Record<string, unknown>;
}

/**
 * Puerto que normaliza un ScanIngestPayload heterogéneo hacia el input
 * que espera el caso de uso de dominio, resolviendo identificadores externos
 * (ej. barcode) a EntityId internos.
 */
export interface ScanIngestNormalizer {
  normalize(payload: ScanIngestPayload): Promise<NewStockReadInput>;
}
