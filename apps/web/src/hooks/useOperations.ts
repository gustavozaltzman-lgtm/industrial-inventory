"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/services/apiClient";
import { queryKeys } from "./queryKeys";

/** No reintentar ante 401: el usuario no va a ganar permisos reintentando. */
function retryUnlessUnauthorized(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.kind === "unauthorized") return false;
  return failureCount < 2;
}

export function useOperationsKpis(warehouseId: string, windowMinutes = 60) {
  return useQuery({
    queryKey: queryKeys.operationsKpis(warehouseId, windowMinutes),
    queryFn: () => apiClient.getOperationsKpis(warehouseId, windowMinutes),
    retry: retryUnlessUnauthorized,
    staleTime: 15_000,
  });
}

export function useDeviceFleet(warehouseId: string) {
  return useQuery({
    queryKey: queryKeys.deviceFleet(warehouseId),
    queryFn: () => apiClient.getDeviceFleet(warehouseId),
    retry: retryUnlessUnauthorized,
    staleTime: 15_000,
  });
}

export function useReconciliation(warehouseId: string) {
  return useQuery({
    queryKey: queryKeys.reconciliation(warehouseId),
    queryFn: () => apiClient.getReconciliation(warehouseId),
    retry: retryUnlessUnauthorized,
    staleTime: 30_000,
  });
}
