CREATE TYPE "public"."capture_source" AS ENUM('ML_KIT_MOBILE', 'COGNEX_SOCKET', 'ZEBRA_SCANNER', 'IP_CAMERA', 'AMR_ROBOT', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."scan_event_type" AS ENUM('STOCK_READ', 'STOCK_ADJUSTMENT', 'CYCLE_COUNT');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending_sync', 'synced', 'sync_failed');--> statement-breakpoint
CREATE TABLE "inventory_scan_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"correlation_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid,
	"sku_id" uuid NOT NULL,
	"event_type" "scan_event_type" NOT NULL,
	"quantity" double precision NOT NULL,
	"capture_source" "capture_source" NOT NULL,
	"device_id" text,
	"operator_id" uuid,
	"image_ref" text,
	"metadata" jsonb,
	"captured_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone,
	"sync_status" "sync_status" DEFAULT 'pending_sync' NOT NULL,
	"adjusts_event_id" uuid
);
--> statement-breakpoint
CREATE TABLE "skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"description" text NOT NULL,
	"unit_of_measure" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scan_events_tenant_id_idx" ON "inventory_scan_events" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "scan_events_tenant_created_idx" ON "inventory_scan_events" USING btree ("tenant_id","captured_at");--> statement-breakpoint
CREATE INDEX "scan_events_tenant_correlation_idx" ON "inventory_scan_events" USING btree ("tenant_id","correlation_id");--> statement-breakpoint
CREATE INDEX "scan_events_tenant_warehouse_idx" ON "inventory_scan_events" USING btree ("tenant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "skus_tenant_id_idx" ON "skus" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "skus_tenant_created_idx" ON "skus" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "warehouses_tenant_id_idx" ON "warehouses" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "warehouses_tenant_created_idx" ON "warehouses" USING btree ("tenant_id","created_at");