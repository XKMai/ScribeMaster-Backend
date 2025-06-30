import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

async function main() {
  const pool = new Pool({
    host: "scribemaster-db.cngy2kewiir4.ap-southeast-1.rds.amazonaws.com",
    port: 5432,
    user: "postgres",
    password: "BUeMb25ED1NbBshV18Me",
    database: "postgres",
    ssl: {
      ca: fs.readFileSync(path.resolve("./global-bundle.pem")).toString(),
    },
  });

  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: "./drizzle/migrations" });

  console.log("✅ Migrations applied successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
