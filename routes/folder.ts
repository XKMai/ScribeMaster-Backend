import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { folders } from "../models/folders";
import { folderItems } from "../models/folderItems";
import { notes } from "../models/notes";

import {
  eq,
  count as drizzleCount,
  and,
  gt,
  gte,
  lt,
  lte,
  sql,
} from "drizzle-orm";

const folderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", folderCreationHandler);
  fastify.get("/:folderId", folderGetHandler);
  fastify.patch("/", folderUpdateHandler);
  fastify.delete("/:folderId", deleteFolderHandler);
};

async function folderCreationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { name, createdBy, settings, folderId } = request.body as {
    name: string;
    createdBy: number;
    settings?: JSON;
    folderId?: number; // Optional to support nested folders
  };

  //Create the folder
  const [folder] = await db
    .insert(folders)
    .values({
      name,
      isCampaign: false,
      settings: settings ?? {},
      createdBy,
    })
    .returning();

  //Add to parent folder via folder_items
  if (folderId) {
    // Determine the next position
    const [{ count }] = await db
      .select({ count: drizzleCount() })
      .from(folderItems)
      .where(eq(folderItems.folderId, folderId));

    const position = Number(count); // Add to end

    await db.insert(folderItems).values({
      folderId,
      type: "folder",
      refId: folder.id,
      position,
    });
  }

  return reply.code(201).send(folder);
}

async function folderGetHandler(request: FastifyRequest, reply: FastifyReply) {
  const { folderId } = request.params as { folderId: number };

  //Main folder query
  const folder = await db.query.folders.findFirst({
    columns: {
      id: true,
      name: true,
      settings: true,
    },
    where: eq(folders.id, folderId),
  });

  if (!folder) {
    return reply.code(404).send({ error: "Folder not found" });
  }

  //Fetch items in the folder
  const items = await db
    .select({
      id: folderItems.id,
      type: folderItems.type,
      refId: folderItems.refId,
      position: folderItems.position,
    })
    .from(folderItems)
    .where(eq(folderItems.folderId, folderId))
    .orderBy(folderItems.position);

  //Hydrate items with their data
  const hydratedItems = await Promise.all(
    items.map(async (item) => {
      let data: any = null;

      if (item.type === "note") {
        data =
          (await db.query.notes.findFirst({
            where: eq(notes.id, item.refId),
          })) ?? null;
      } else if (item.type === "folder") {
        data =
          (await db.query.folders.findFirst({
            where: eq(folders.id, item.refId),
          })) ?? null;
      }

      return { ...item, data };
    })
  );

  return {
    ...folder,
    items: hydratedItems,
  };
}

async function folderUpdateHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { itemId, toFolderId, newPosition } = request.body as {
    itemId: number;
    toFolderId: number;
    newPosition: number;
  };

  // Fetch the item being moved
  const item = await db
    .select()
    .from(folderItems)
    .where(eq(folderItems.id, itemId))
    .then((rows) => rows[0]);

  if (!item) {
    return reply.code(404).send({ error: "Item not found" });
  }

  const fromFolderId = item.folderId;
  const fromPosition = item.position;

  await db.transaction(async (trx) => {
    // Adjust positions in the original folder if moving out
    if (fromFolderId !== toFolderId) {
      await trx
        .update(folderItems)
        .set({ position: sql`${folderItems.position} - 1` })
        .where(
          and(
            eq(folderItems.folderId, fromFolderId),
            gt(folderItems.position, fromPosition)
          )
        );
    } else {
      // Reordering within the same folder
      if (newPosition > fromPosition) {
        await trx
          .update(folderItems)
          .set({ position: sql`${folderItems.position} - 1` })
          .where(
            and(
              eq(folderItems.folderId, fromFolderId),
              gt(folderItems.position, fromPosition),
              lte(folderItems.position, newPosition)
            )
          );
      } else if (newPosition < fromPosition) {
        await trx
          .update(folderItems)
          .set({ position: sql`${folderItems.position} + 1` })
          .where(
            and(
              eq(folderItems.folderId, fromFolderId),
              gte(folderItems.position, newPosition),
              lt(folderItems.position, fromPosition)
            )
          );
      }
    }

    // Adjust positions in the destination folder if moved
    if (fromFolderId !== toFolderId) {
      await trx
        .update(folderItems)
        .set({ position: sql`${folderItems.position} + 1` })
        .where(
          and(
            eq(folderItems.folderId, toFolderId),
            gte(folderItems.position, newPosition)
          )
        );
    }

    // Move the item
    await trx
      .update(folderItems)
      .set({
        folderId: toFolderId,
        position: newPosition,
      })
      .where(eq(folderItems.id, itemId));
  });

  return reply.code(200).send({ success: true });
}

async function deleteFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { folderId } = request.params as { folderId: number };

  // Check if the folder exists
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
  });

  if (!folder) {
    return reply.code(404).send({ error: "Folder not found" });
  }

  // Recursive function to delete folder contents
  async function deleteFolderRecursive(folderId: number) {
    // Get all items in the folder
    const items = await db
      .select()
      .from(folderItems)
      .where(eq(folderItems.folderId, folderId));

    for (const item of items) {
      if (item.type === "note") {
        // Delete the note
        await db.delete(notes).where(eq(notes.id, item.refId));
      } else if (item.type === "folder") {
        // Recursively delete the subfolder
        await deleteFolderRecursive(item.refId);
      }

      // Delete the folderItem reference itself
      await db.delete(folderItems).where(eq(folderItems.id, item.id));
    }

    // Finally, delete the folder itself
    await db.delete(folders).where(eq(folders.id, folderId));
  }

  await deleteFolderRecursive(folderId);

  return reply.code(204).send();
}

export default folderRoutes;
