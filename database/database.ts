import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parse } from "pg-connection-string";
import fs from "fs"; // ✅ IMPORT fs FIRST
import path from "path";

import { notes } from "../models/notes.ts";
import { users } from "../models/users.ts";
import { folders } from "../models/folders.ts";
import { entity } from "../models/entity.ts";
import { folderItems } from "../models/folderItems.ts";
import { items } from "../models/items.ts";
import { spell } from "../models/spell.ts";
import { playerCharacter } from "../models/player.ts";

console.log("⚡ DB setup file loaded");

dotenv.config();

const dbConfig = parse(process.env.DATABASE_URL ?? "");

const sslOptions = (() => {
  const certPath = path.resolve("./global-bundle.pem");

  if (fs.existsSync(certPath)) {
    console.log("✅ SSL certificate file found. Using CA bundle for SSL.");
    return {
      ca: fs.readFileSync(certPath).toString(),
    };
  } else {
    console.warn("⚠️ SSL certificate file not found. Skipping CA bundle.");
    return false;
  }
})();

const pool = new Pool({
  host: dbConfig.host ?? undefined,
  port: dbConfig.port ? parseInt(dbConfig.port) : 5432,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database ?? undefined,
  ssl: sslOptions || undefined,
});

export const db = drizzle(pool, {
  schema: {
    users,
    folders,
    folderItems,
    notes,
    entity,
    playerCharacter,
    items,
    spell,
  },
