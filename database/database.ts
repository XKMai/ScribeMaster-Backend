import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { notes } from "../models/notes.ts";
import { users } from "../models/users.ts";
import { folders } from "../models/folders.ts";
import { entity } from "../models/entity.ts";
import { folderItems } from "../models/folderItems.ts";
import { items } from "../models/items.ts";
import { spell } from "../models/spell.ts";
import { playerCharacter } from "../models/player.ts";

dotenv.config(); //Load .env before anything else

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Setup db connection based on DB URL
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
}); // Schema-aware DB instance
