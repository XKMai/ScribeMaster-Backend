import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parse } from "pg-connection-string";
import { notes } from "../models/notes.ts";
import { users } from "../models/users.ts";
import { folders } from "../models/folders.ts";

dotenv.config();

const dbConfig = parse(process.env.DATABASE_URL ?? "");

const fs = require("fs");

const pool = new Pool({
  host: dbConfig.host ?? undefined,
  port: dbConfig.port ? parseInt(dbConfig.port) : 5432,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database ?? undefined,
  //connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    ca: fs.readFileSync("/usr/src/app/global-bundle.pem").toString(),
  },
});

export const db = drizzle(pool, { schema: { notes, users, folders } });
