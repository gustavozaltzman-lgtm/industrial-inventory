import "dotenv/config";
import { Pool, type PoolClient } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export type Db = NodePgDatabase<typeof schema>;

export const db: Db = drizzle(pool, { schema });

/**
 * Ejecuta `fn` dentro de una transacción con `app.tenant_id` fijado como
 * variable de sesión local, para que las políticas RLS de Postgres (ver
 * rls.sql) filtren automáticamente por tenant sin depender de que cada
 * query recuerde agregar el WHERE tenant_id = ... (ADR-001 §5).
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const tx = drizzle(client, { schema });
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client?.query("ROLLBACK");
    throw error;
  } finally {
    client?.release();
  }
}
