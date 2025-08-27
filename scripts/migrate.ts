import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

async function main() {
  // Construct SSL path safely
  const sslCertPath = path.resolve("./global-bundle.pem");

  // Ensure the certificate exists before continuing
  if (!fs.existsSync(sslCertPath)) {
    throw new Error(`❌ SSL certificate not found at: ${sslCertPath}`);
  }

  // Create PostgreSQL connection pool
  const pool = new Pool({
    host: "database-1.cngy2kewiir4.ap-southeast-1.rds.amazonaws.com",
    port: 5432,
    user: "postgres",
    password: "BUeMb25ED1NbBshV18Me",
    database: "postgres",
    ssl: {
      ca: fs.readFileSync(sslCertPath).toString(),
    },
  });

  try {
    const db = drizzle(pool);

    console.log("🚀 Running migrations...");
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("✅ Migrations applied successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
