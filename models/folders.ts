import { integer, pgTable, varchar, boolean, json } from "drizzle-orm/pg-core";
import { users } from "./users";

export const folders = pgTable("folders", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  isCampaign: boolean().default(false),
  settings: json(), // campaign config
  createdBy: integer()
    .references(() => users.id)
    .notNull(),
});
