CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SUPERVISOR', 'OPERATOR');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"code" text NOT NULL,
	"aisle" text,
	"rack" text,
	"level" text,
	"depth_cm" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "skus_tenant_id_idx";--> statement-breakpoint
DROP INDEX "skus_tenant_created_idx";--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "width_cm" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "height_cm" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "depth_cm" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "weight_kg" double precision NOT NULL;--> statement-breakpoint
CREATE INDEX "locations_tenant_id_idx" ON "locations" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "locations_tenant_warehouse_idx" ON "locations" USING btree ("tenant_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "users_tenant_id_idx" ON "users" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "users_tenant_email_idx" ON "users" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "products_tenant_id_idx" ON "skus" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "products_tenant_created_idx" ON "skus" USING btree ("tenant_id","created_at");