import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { items } from "../models/items";
import { folderItems } from "../models/folderItems";
import { eq } from "drizzle-orm";

const itemsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", itemsCreationHandler);
  fastify.get("/:itemId", itemGetHandler);
  fastify.get("/user/:userId", getUserItemsHandler);
  fastify.patch("/:itemId", itemUpdateHandler);
  fastify.delete("/:itemId", itemDeleteHandler);
};

async function itemsCreationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { type, description, characteristics, createdBy, folderId, settings } =
    request.body as {
      type: string;
      description: string;
      characteristics: Record<string, any>;
      createdBy: number;
      folderId?: number;
      settings?: Record<string, any>;
    };

  const [item] = await db
    .insert(items)
    .values({
      type,
      description,
      characteristics,
      createdBy,
      settings: settings ?? {},
    })
    .returning();

  return reply.code(201).send(item);
}

async function itemGetHandler(request: FastifyRequest, reply: FastifyReply) {
  const { itemId } = request.params as { itemId: number };

  const item = await db
    .select()
    .from(items)
    .where(eq(items.id, itemId))
    .then((results) => results[0]);

  if (!item) {
    return reply.code(404).send({ error: "Item not found" });
  }

  return reply.code(200).send(item);
}

async function getUserItemsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { userId } = request.params as { userId: number };

  const itemsList = await db
    .select()
    .from(items)
    .where(eq(items.createdBy, userId));

  if (itemsList.length === 0) {
    return reply.code(404).send({ error: "No items found for this user" });
  }

  return reply.code(200).send(itemsList);
}

async function itemUpdateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { itemId } = request.params as { itemId: number };
  const { type, description, characteristics, settings } = request.body as {
    type?: string;
    description?: string;
    characteristics?: Record<string, any>;
    settings?: Record<string, any>;
  };

  const [updatedItem] = await db
    .update(items)
    .set({
      type: type ?? undefined,
      description: description ?? undefined,
      characteristics: characteristics ?? undefined,
      settings: settings ?? undefined,
    })
    .where(eq(items.id, itemId))
    .returning();

  if (!updatedItem) {
    return reply.code(404).send({ error: "Item not found" });
  }

  return reply.code(200).send(updatedItem);
}

async function itemDeleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { itemId } = request.params as { itemId: number };

  const deletedItem = await db
    .delete(items)
    .where(eq(items.id, itemId))
    .returning();

  if (deletedItem.length === 0) {
    return reply.code(404).send({ error: "Item not found" });
  }

  // Clean up folder references
  await db.delete(folderItems).where(eq(folderItems.refId, itemId));

  return reply.code(204).send();
}

export default itemsRoutes;
