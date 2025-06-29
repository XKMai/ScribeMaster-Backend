import {
  pgTable,
  integer,
  varchar,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const attacks = pgTable("attacks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  createdBy: integer("created_by") // ID of the user who created the item
    .references(() => users.id)
    .notNull(),
  settings: json(), // Additional settings or configurations for the item
  type: varchar({ length: 50 }).notNull(), // e.g. 'weapon', 'armour', 'accessory', 'goods', 'consumable'
  description: varchar().notNull(), // Description of the item
  characteristics: json().notNull(), // JSON object containing item characteristics
});
