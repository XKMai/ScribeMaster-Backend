import { pgTable, integer, varchar, boolean, json } from "drizzle-orm/pg-core";
import { users } from "./users";
import { items } from "./items";
import { features } from "process";
import { relations } from "drizzle-orm";
import { spell } from "./spell";
import { entity } from "./entity";

export const playerCharacter = pgTable("player_character", {
  id: integer("id")
    .primaryKey()
    .references(() => entity.id)
    .notNull(),

  playerName: varchar("player_name", { length: 100 }),

  level: integer("level").notNull(),
  characterClass: varchar({ length: 50 }).notNull(),
  background: varchar({ length: 100 }),
  alignment: varchar({ length: 20 }),
  experience: integer("experience").default(0),

  inspiration: boolean().default(false),
  hitDice: varchar({ length: 50 }).default(""), // e.g., "1d8" for a level 1 character

  personality: json(), // JSON object containing personality stuff{traits: string, ideals: string, bonds: string, flaws: string},
  notes: varchar().default(""), // General notes about the character
  backstory: varchar().default(""), // Backstory of the character
  treasure: varchar().default(""), // Treasure or items of significance to the character
  alliesOrgs: varchar().default(""), // Allies and organizations associated with the character

  // Relationships can be added later (campaigns, sessions, etc.)
});
