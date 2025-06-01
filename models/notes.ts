import {
  pgTable,
  integer,
  varchar,
  text
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const notes = pgTable("notes", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }),
  content: text(),
  createdBy: integer().references(() => users.id).notNull(),
});