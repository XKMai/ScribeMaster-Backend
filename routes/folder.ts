import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { folders } from "../models/folders";
import { folderItems } from "../models/folderItems";
import { notes } from "../models/notes";
import { entity } from "../models/entity";

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
import { spell } from "../models/spell";
import { items } from "../models/items";
import { playerCharacter } from "../models/player";

const folderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", folderCreationHandler);
  fastify.get("/:folderId", folderGetHandler);
  fastify.patch("/:folderId", folderUpdateHandler);
  fastify.patch("/move", folderMovementHandler);
  fastify.delete("/:folderId", deleteFolderHandler);
  fastify.delete("/item/:itemId", deleteFolderItemHandler);
};

async function folderCreationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { name, createdBy, settings, folderId } = request.body as {
    name: string;
    createdBy: number;
    settings?: JSON;
    folderId: number; //Required if this folder is a subfolder
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

    // Insert the folder item
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
  const folderItemsList = await db
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
    folderItemsList.map(async (item) => {
      let data: any = null;

      switch (item.type) {
        case "note":
          data = await db.query.notes.findFirst({
            where: eq(notes.id, item.refId),
          });
          break;

        case "folder":
          data = await db.query.folders.findFirst({
            where: eq(folders.id, item.refId),
          });
          break;

        case "entity":
        case "player": {
          // Always fetch the base entity
          const baseEntity = await db.query.entity.findFirst({
            where: eq(entity.id, item.refId),
          });

          if (!baseEntity) break;

          // If its a player, fetch the player character data as well and stick it to the data
          if (item.type === "player") {
            const playerData = await db.query.playerCharacter.findFirst({
              where: eq(playerCharacter.id, item.refId),
            });

            data = {
              ...baseEntity,
              playerCharacter: playerData ?? null,
            };
          } else {
            data = baseEntity;
          }

          break;
        }

        case "item":
          data = await db.query.items.findFirst({
            where: eq(items.id, item.refId),
          });
          break;

        case "spell":
          data = await db.query.spell.findFirst({
            where: eq(spell.id, item.refId),
          });
          break;

        default:
          data = null;
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
  const { folderId } = request.params as { folderId: number };
  const { name, settings } = request.body as {
    name?: string;
    settings?: JSON;
  };

  // Check if the folder exists
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
  });

  if (!folder) {
    return reply.code(404).send({ error: "Folder not found" });
  }

  // Update the folder
  const updatedFolder = await db
    .update(folders)
    .set({
      name: name ?? folder.name,
      settings: settings ?? folder.settings,
    })
    .where(eq(folders.id, folderId))
    .returning();

  return reply
    .code(200)
    .send({ message: "Folder updated", folder: updatedFolder[0] });
}

async function folderMovementHandler(
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

  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
  });

  if (!folder) {
    return reply.code(404).send({ error: "Folder not found" });
  }

  await db.transaction(async (trx) => {
    async function deleteFolderRecursive(folderId: number) {
      const items = await trx
        .select()
        .from(folderItems)
        .where(eq(folderItems.folderId, folderId));

      for (const item of items) {
        if (item.type === "note") {
          await trx.delete(notes).where(eq(notes.id, item.refId));
        } else if (item.type === "folder") {
          await deleteFolderRecursive(item.refId);
        }

        // Always remove the folderItem itself
        await trx.delete(folderItems).where(eq(folderItems.id, item.id));
      }

      // Delete this folder from its parent (if it exists)
      await trx
        .delete(folderItems)
        .where(
          and(eq(folderItems.refId, folderId), eq(folderItems.type, "folder"))
        );

      // Delete the folder itself
      await trx.delete(folders).where(eq(folders.id, folderId));
    }

    await deleteFolderRecursive(folderId);
  });

  return reply.code(204).send();
}

//To delete items from folder, including entities, spells, items, etc.
//Does not actually delete the item itself, just removes it from the folder
async function deleteFolderItemHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { itemId } = request.params as { itemId: number };

  // Find the item
  const item = await db
    .select()
    .from(folderItems)
    .where(eq(folderItems.id, itemId))
    .then((res) => res[0]);

  if (!item) {
    return reply.code(404).send({ error: "Folder item not found" });
  }

  const { folderId, position } = item;

  // Remove the item and shift remaining positions
  await db.transaction(async (trx) => {
    // Delete the item
    await trx.delete(folderItems).where(eq(folderItems.id, itemId));

    // Shift down the position of items that came after it
    await trx
      .update(folderItems)
      .set({ position: sql`${folderItems.position} - 1` })
      .where(
        and(
          eq(folderItems.folderId, folderId),
          gt(folderItems.position, position)
        )
      );
  });

  return reply.code(204).send();
}

export default folderRoutes;
