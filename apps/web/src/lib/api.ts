import type { InventoryScanEvent } from "@indinv/core-domain";

const API_BASE_URL = process.env.INDINV_API_URL ?? "http://localhost:3001";

export async function getWarehouseScanEvents(
  tenantId: string,
  warehouseId: string,
): Promise<InventoryScanEvent[]> {
  const response = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}/scan-events`, {
    headers: { "x-tenant-id": tenantId },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load scan events: ${response.status}`);
  }

  return response.json();
}
