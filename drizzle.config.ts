import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import fs from "fs";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./models/**/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: {
      rejectUnauthorized: false,
      ca: fs.readFileSync("/usr/src/app/global-bundle.pem").toString(),
    },
  },
});
