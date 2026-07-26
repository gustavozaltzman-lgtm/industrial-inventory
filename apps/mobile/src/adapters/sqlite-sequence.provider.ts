import { eq, sql } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import * as schema from "../db/schema";
import type { SequenceProvider } from "../engine/ports";

/**
 * Contador monotónico por dispositivo persistido en SQLite. El UPSERT atómico
 * evita que dos capturas rápidas (operario escaneando en ráfaga) obtengan el
 * mismo número, cosa que rompería la detección de huecos en la secuencia.
 */
export class SqliteSequenceProvider implements SequenceProvider {
  constructor(private readonly db: ExpoSQLiteDatabase<typeof schema>) {}

  async next(deviceId: string): Promise<number> {
    await this.db
      .insert(schema.deviceSequence)
      .values({ deviceId, lastSequence: 1 })
      .onConflictDoUpdate({
        target: schema.deviceSequence.deviceId,
        set: { lastSequence: sql`${schema.deviceSequence.lastSequence} + 1` },
      });

    const [row] = await this.db
      .select({ lastSequence: schema.deviceSequence.lastSequence })
      .from(schema.deviceSequence)
      .where(eq(schema.deviceSequence.deviceId, deviceId))
      .limit(1);

    return row?.lastSequence ?? 1;
  }
}
