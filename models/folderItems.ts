import { pgTable, integer, varchar, timestamp } from "drizzle-orm/pg-core";

import { folders } from "./folders";

export const folderItems = pgTable("folder_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(), // Unique ID for each item within a folder
  folderId: integer("folder_id") //Id of the folder this item belongs to
    .references(() => folders.id)
    .notNull(),
  type: varchar({ length: 50 }).notNull(), // e.g. 'note', 'entity', 'folder'
  refId: integer("ref_id").notNull(), // ID in the referenced table for that item
  position: integer().notNull(), // used for manual ordering
});
