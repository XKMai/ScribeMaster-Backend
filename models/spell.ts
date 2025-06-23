import { pgTable, integer, varchar, json, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { items } from "./items";
import { features } from "process";
import { relations } from "drizzle-orm";

export const spell = pgTable("spell", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(), // Unique ID for each spell
  name: varchar().notNull(), // Name of the spell

  level: integer().notNull(), // Spell level (0 for cantrips, 1-9 for higher levels)
  school: varchar({ length: 50 }).notNull(), // School of magic (e.g., Evocation, Illusion)
  castingTime: varchar({ length: 50 }).notNull(), // Casting time (e.g., "1 action", "1 bonus action")
  range: varchar({ length: 50 }).notNull(), // Range of the spell (e.g., "60 feet", "Self")
  components: text("components") // Components required (e.g., ["V", "S", "M"])
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  duration: varchar({ length: 50 }).notNull(), // Duration of the spell (e.g., "1 minute", "Instantaneous")

  description: varchar().notNull(), // Description of the spell
  higherLevel: varchar().notNull(), // Description of the spell at higher levels, if applicable

  classes: text("classes") // Classes that can cast this spell (e.g., ["Wizard", "Sorcerer"])
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),

  createdBy: integer("created_by") // ID of the user who created the spell
    .references(() => users.id)
    .notNull(),
  settings: json(), // Additional settings or configurations for the spell
});
