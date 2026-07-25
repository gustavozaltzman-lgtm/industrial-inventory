-- Row Level Security multi-tenant (ADR-001 §5).
-- Se aplica luego de las migraciones de drizzle-kit sobre cada tabla de dominio.
-- Idempotente: cada CREATE POLICY está protegido para poder re-ejecutar este
-- script sin fallar si la política ya existe (drizzle-kit no versiona RLS).

DO $$
BEGIN
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users FORCE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY tenant_isolation_users ON users
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

DO $$
BEGIN
  ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
  ALTER TABLE warehouses FORCE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY tenant_isolation_warehouses ON warehouses
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

DO $$
BEGIN
  ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE locations FORCE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY tenant_isolation_locations ON locations
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

DO $$
BEGIN
  ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
  ALTER TABLE skus FORCE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY tenant_isolation_products ON skus
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

DO $$
BEGIN
  ALTER TABLE inventory_scan_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE inventory_scan_events FORCE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY tenant_isolation_scan_events ON inventory_scan_events
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
