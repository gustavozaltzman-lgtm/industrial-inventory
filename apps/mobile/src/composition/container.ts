import { db, initLocalDb } from "../db/client";
import { ExpoDeviceAdapter } from "../adapters/device/ExpoDeviceAdapter";
import { HapticFeedbackAdapter } from "../adapters/feedback/HapticFeedbackAdapter";
import { MlKitBarcodeEngineAdapter } from "../adapters/barcode/MlKitBarcodeEngineAdapter";
import { StaticCatalogResolver } from "../adapters/catalog/StaticCatalogResolver";
import { SqliteInventoryEventRepository } from "../adapters/sqlite-inventory-event.repository";
import { SqliteSequenceProvider } from "../adapters/sqlite-sequence.provider";
import { SecureTokenStore } from "../adapters/secure-token-store";
import { CaptureEngine } from "../engine/CaptureEngine";
import { QueueManager } from "../services/sync/QueueManager";
import { HttpSyncApiClient } from "../services/sync/HttpSyncApiClient";
import { BackgroundSyncService } from "../services/sync/BackgroundSyncService";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://indinv-backend.onrender.com";

export const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_WAREHOUSE_ID = "00000000-0000-0000-0000-000000000002";

// Catálogo de desarrollo; ver TODO en StaticCatalogResolver.
const DEMO_SKUS = new Map([["7790001", "00000000-0000-0000-0000-000000000003"]]);
const DEMO_LOCATIONS = new Map([["A-01-02", "00000000-0000-0000-0000-000000000004"]]);

export interface Container {
  captureEngine: CaptureEngine;
  queue: QueueManager;
  sync: BackgroundSyncService;
  repository: SqliteInventoryEventRepository;
  tenantId: string;
  warehouseId: string;
}

let container: Container | null = null;

/**
 * Composition root: el único lugar donde se instancian implementaciones
 * concretas. La UI recibe el grafo ya armado y solo conoce interfaces.
 */
export function getContainer(): Container {
  if (container) return container;

  initLocalDb();

  const device = new ExpoDeviceAdapter();
  const repository = new SqliteInventoryEventRepository(db);
  const queue = new QueueManager(db);
  const tokenStore = new SecureTokenStore();

  const captureEngine = new CaptureEngine({
    barcodeEngine: new MlKitBarcodeEngineAdapter(),
    repository,
    device,
    feedback: new HapticFeedbackAdapter(),
    sequence: new SqliteSequenceProvider(db),
    catalog: new StaticCatalogResolver(DEMO_SKUS, DEMO_LOCATIONS),
  });

  const sync = new BackgroundSyncService(
    queue,
    new HttpSyncApiClient({ baseUrl: API_BASE_URL, tokenStore }),
    device,
    { tenantId: DEMO_TENANT_ID },
  );

  container = {
    captureEngine,
    queue,
    sync,
    repository,
    tenantId: DEMO_TENANT_ID,
    warehouseId: DEMO_WAREHOUSE_ID,
  };
  return container;
}
