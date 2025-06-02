import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { notes } from "../models/notes.ts";
import { users } from "../models/users.ts";
import { folders } from "../models/folders.ts";

dotenv.config(); //Load .env before anything else

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Setup db connection based on DB URL
});

export const db = drizzle(pool, { schema: { notes, users, folders } }); // Schema-aware DB instance
