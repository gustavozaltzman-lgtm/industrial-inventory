import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  await migrate(db, { migrationsFolder: join(__dirname, "../../../drizzle") });

  const rlsSql = readFileSync(join(__dirname, "rls.sql"), "utf-8");
  await pool.query(rlsSql);

  console.log("Migrations + RLS policies applied.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
