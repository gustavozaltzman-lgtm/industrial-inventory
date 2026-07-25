import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const captureSourceEnum = pgEnum("capture_source", [
  "ML_KIT_MOBILE",
  "COGNEX_SOCKET",
  "ZEBRA_SCANNER",
  "IP_CAMERA",
  "AMR_ROBOT",
  "MANUAL",
]);

export const scanEventTypeEnum = pgEnum("scan_event_type", [
  "STOCK_READ",
  "STOCK_ADJUSTMENT",
  "CYCLE_COUNT",
]);

export const syncStatusEnum = pgEnum("sync_status", ["pending_sync", "synced", "sync_failed"]);

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "SUPERVISOR", "OPERATOR"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("users_tenant_id_idx").on(table.tenantId, table.id),
    index("users_tenant_email_idx").on(table.tenantId, table.email),
  ],
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("warehouses_tenant_id_idx").on(table.tenantId, table.id),
    index("warehouses_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    code: text("code").notNull(),
    aisle: text("aisle"),
    rack: text("rack"),
    level: text("level"),
    depthCm: doublePrecision("depth_cm"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("locations_tenant_id_idx").on(table.tenantId, table.id),
    index("locations_tenant_warehouse_idx").on(table.tenantId, table.warehouseId),
  ],
);

export const products = pgTable(
  "skus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    description: text("description").notNull(),
    unitOfMeasure: text("unit_of_measure").notNull(),
    widthCm: doublePrecision("width_cm").notNull(),
    heightCm: doublePrecision("height_cm").notNull(),
    depthCm: doublePrecision("depth_cm").notNull(),
    weightKg: doublePrecision("weight_kg").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("products_tenant_id_idx").on(table.tenantId, table.id),
    index("products_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

/**
 * Tabla de eventos inmutables (ADR-001 §3). No hay UPDATE de negocio sobre
 * esta tabla salvo la transición de syncStatus al confirmarse la ingesta.
 */
export const inventoryScanEvents = pgTable(
  "inventory_scan_events",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    locationId: uuid("location_id"),
    skuId: uuid("sku_id").notNull(),
    eventType: scanEventTypeEnum("event_type").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    captureSource: captureSourceEnum("capture_source").notNull(),
    deviceId: text("device_id"),
    sequenceNumber: integer("sequence_number"),
    operatorId: uuid("operator_id"),
    imageRef: text("image_ref"),
    metadata: jsonb("metadata"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending_sync"),
    adjustsEventId: uuid("adjusts_event_id"),
  },
  (table) => [
    index("scan_events_tenant_id_idx").on(table.tenantId, table.id),
    index("scan_events_tenant_created_idx").on(table.tenantId, table.capturedAt),
    index("scan_events_tenant_correlation_idx").on(table.tenantId, table.correlationId),
    index("scan_events_tenant_warehouse_idx").on(table.tenantId, table.warehouseId),
  ],
);
