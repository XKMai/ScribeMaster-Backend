import { pgTable, integer, varchar, timestamp } from "drizzle-orm/pg-core";

import { folders } from "./folders";

export const folderItems = pgTable("folder_items", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  folderId: integer("folder_id")
    .references(() => folders.id)
    .notNull(),
  type: varchar({ length: 50 }).notNull(), // e.g. 'note', 'entity', 'folder'
  refId: integer("ref_id").notNull(), // ID in the referenced table for that type
  position: integer().notNull(), // used for manual ordering
});
