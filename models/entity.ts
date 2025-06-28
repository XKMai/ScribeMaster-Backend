import {
  pgTable,
  integer,
  varchar,
  timestamp,
  json,
  PgArray,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { items } from "./items";
import { features } from "process";
import { relations } from "drizzle-orm";
import { spell } from "./spell";

export const entity = pgTable("entity", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(), // Unique ID for each item within a folder
  createdBy: integer("created_by") // ID of the user who created the item
    .references(() => users.id)
    .notNull(),
  settings: json(), // Additional settings or configurations for the item

  type: varchar({ length: 50 }).notNull(), // e.g. 'friendly', 'neutral', 'hostile', 'player'
  name: varchar().notNull(), // name of the entity
  race: varchar({ length: 50 }).notNull(), // e.g. 'human', 'elf', 'beast'
  description: varchar().notNull(), // Description of the entity

  stats: json().notNull(), // JSON object containing entity characteristics
  hp: integer().notNull(), // Health points of the entity
  maxhp: integer().notNull(), // Maximum health points of the entity
  temphp: integer().default(0), // Temporary health points of the entity

  ac: integer().notNull(), // Armor class of the entity
  speed: integer().notNull(), // Speed of the entity
  initiative: integer().notNull(), // Initiative value for combat
  passivePerception: integer().notNull(), // Passive perception value

  savingThrows: json().notNull(), // JSON object containing saving throw modifiers
  skills: json().notNull(), // JSON object containing skill modifiers

  features: varchar().notNull(), // String containing features, traits, abilities of the entity; Might change to json if needed
  attacks: json().notNull(), // JSON object containing attack actions of the entity, including spells if needed

  spellcasting: json(), // JSON object containing spellcasting information, if applicable {spellcastingAbility: string, spellSaveDC: number, spellAttackBonus: number, etc.}

  currency: json().notNull(), // JSON object containing currency information, e.g. {gold: number, electrum:number, silver: number, copper: number}
  otherProficiencies: json().notNull(), // JSON object containing other proficiencies, languages, tools, etc.
});

export const entityRelations = relations(entity, ({ many }) => ({
  spells: many(spell),
  items: many(items),
}));

export const entitySpells = pgTable("entity_spells", {
  entityId: integer("entity_id")
    .references(() => entity.id)
    .notNull(),
  spellId: integer("spell_id")
    .references(() => spell.id)
    .notNull(),
});

export const entityItems = pgTable("entity_items", {
  entityId: integer("entity_id")
    .references(() => entity.id)
    .notNull(),
  itemId: integer("item_id")
    .references(() => items.id)
    .notNull(),
});
