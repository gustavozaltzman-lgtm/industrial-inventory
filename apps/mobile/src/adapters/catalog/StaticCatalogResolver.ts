import type { CatalogResolver } from "../../engine/ports";

/**
 * Resolver de catálogo para desarrollo: mapea códigos contra tablas en
 * memoria sembradas al arrancar.
 *
 * TODO producción: reemplazar por un resolver que lea el catálogo cacheado en
 * SQLite y se refresque desde el backend. La interfaz no cambia, así que ni
 * el CaptureEngine ni la UI se enteran del reemplazo.
 */
export class StaticCatalogResolver implements CatalogResolver {
  constructor(
    private readonly skusByBarcode: ReadonlyMap<string, string>,
    private readonly locationsByCode: ReadonlyMap<string, string>,
  ) {}

  async resolveSkuByBarcode(_tenantId: string, barcode: string): Promise<string | null> {
    return this.skusByBarcode.get(barcode) ?? null;
  }

  async resolveLocationByCode(_tenantId: string, code: string): Promise<string | null> {
    return this.locationsByCode.get(code) ?? null;
  }
}
