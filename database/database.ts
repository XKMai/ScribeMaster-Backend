import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../models/user.ts';

dotenv.config(); //Load .env before anything else

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Setup db connection based on DB URL
}); 

export const db = drizzle(pool, { schema }); // Schema-aware DB instance
