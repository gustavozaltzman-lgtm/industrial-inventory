/** Claves de cache centralizadas: evita invalidaciones que no matchean por typo. */
export const queryKeys = {
  operationsKpis: (warehouseId: string, windowMinutes: number) =>
    ["operations", "kpis", warehouseId, windowMinutes] as const,
  deviceFleet: (warehouseId: string) => ["operations", "devices", warehouseId] as const,
  reconciliation: (warehouseId: string) => ["operations", "reconciliation", warehouseId] as const,
} as const;
