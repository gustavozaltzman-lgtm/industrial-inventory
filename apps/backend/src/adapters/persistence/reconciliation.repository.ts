import { and, eq, sql } from "drizzle-orm";
import type { ReconciliationRow } from "@indinv/core-domain";
import { withTenantContext } from "./db.js";
import { inventoryScanEvents, products } from "./schema.js";

/**
 * Conciliación teórico vs. contado.
 *
 * LIMITACIÓN CONOCIDA: no existe tabla de stock teórico, así que
 * `theoreticalQuantity` y `variance` se devuelven en null. La UI los muestra
 * como "sin dato" en lugar de asumir cero, que un operador leería como
 * "faltante total". Cuando exista la tabla, solo cambia este archivo.
 */
export class ReconciliationRepository {
  async listByWarehouse(tenantId: string, warehouseId: string): Promise<ReconciliationRow[]> {
    return withTenantContext(tenantId, async (tx) => {
      const rows = await tx
        .select({
          skuId: inventoryScanEvents.skuId,
          sku: products.sku,
          description: products.description,
          countedQuantity: sql<number>`sum(${inventoryScanEvents.quantity})`,
          lastCountedAt: sql<Date>`max(${inventoryScanEvents.capturedAt})`,
        })
        .from(inventoryScanEvents)
        .leftJoin(
          products,
          and(
            eq(products.id, inventoryScanEvents.skuId),
            eq(products.tenantId, inventoryScanEvents.tenantId),
          ),
        )
        .where(
          and(
            eq(inventoryScanEvents.tenantId, tenantId),
            eq(inventoryScanEvents.warehouseId, warehouseId),
          ),
        )
        .groupBy(inventoryScanEvents.skuId, products.sku, products.description);

      return rows.map((row) => ({
        skuId: row.skuId,
        // El left join puede no encontrar el producto si el catálogo aún no se
        // cargó; se muestra el id en crudo antes que romper la fila.
        sku: row.sku ?? row.skuId.slice(0, 8),
        description: row.description ?? "Producto no catalogado",
        locationCode: null,
        theoreticalQuantity: null,
        countedQuantity: Number(row.countedQuantity),
        variance: null,
        lastCountedAt: row.lastCountedAt ? new Date(row.lastCountedAt).toISOString() : null,
      }));
    });
  }
}
