import type { InventoryScanEvent } from "@indinv/core-domain";

/**
 * Contador monotónico persistido por dispositivo. Vive detrás de un puerto
 * porque en tests necesita ser determinístico y en producción sobrevivir a
 * reinicios de la app.
 */
export interface SequenceProvider {
  next(deviceId: string): Promise<number>;
}

/**
 * Traduce lo que el operario escanea (un código de barras, un código de
 * ubicación) a los identificadores internos que exige el dominio. Offline
 * resuelve contra el catálogo cacheado en SQLite.
 */
export interface CatalogResolver {
  resolveSkuByBarcode(tenantId: string, barcode: string): Promise<string | null>;
  resolveLocationByCode(tenantId: string, code: string): Promise<string | null>;
}

export type CaptureListener = (event: InventoryScanEvent) => void;

export interface Clock {
  nowIso(): string;
}

export const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
};
