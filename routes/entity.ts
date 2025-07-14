import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import {
  entity,
  entityAttacks,
  entityItems,
  entitySpells,
} from "../models/entity";
import { playerCharacter } from "../models/player";
import { eq, count as drizzleCount } from "drizzle-orm";
import { z } from "zod";
import { spell } from "../models/spell";
import { items } from "../models/items";
import { folderItems } from "../models/folderItems";
import { folders } from "../models/folders";
import { attacks } from "../models/attacks";

const entityRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", createEntityHandler);
  fastify.get("/:entityId", getEntityHandler);
  fastify.get("/:entityId/summary", getEntitySummaryHandler);

  fastify.get("/user/:userId", getEntityIdsByUserHandler);
  fastify.patch("/:entityId", updateEntityHandler.bind(fastify));

  fastify.post("/folder", addEntityToFolderHandler);
  fastify.delete("/:entityId", deleteEntityHandler);
};

const entitySchema = z.object({
  createdBy: z.number(),
  type: z.string().min(1),
  name: z.string().min(1),
  race: z.string().min(1),
  description: z.string().min(1),

  stats: z.object({}).passthrough(),
  hp: z.number(),
  maxhp: z.number(),
  temphp: z.number().default(0),

  ac: z.number(),
  speed: z.number(),
  initiative: z.number(),
  passivePerception: z.number(),

  savingThrows: z.object({}).passthrough(),
  skills: z.object({}).passthrough(),

  features: z.string(),
  attacks: z.object({}).passthrough(),

  spellcasting: z.object({}).nullable().optional(),
  settings: z.object({}).passthrough().default({}),

  currency: z.object({}).passthrough(),
  otherProficiencies: z.object({}).passthrough(),
});

const partialEntitySchema = entitySchema.partial();

const playerCharacterSchema = z.object({
  playerName: z.string().min(1),
  level: z.number().min(1),
  characterClass: z.string().min(1),
  background: z.string().optional(),
  alignment: z.string().optional(),
  experience: z.number().optional(),

  inspiration: z.boolean().optional(),

  personality: z.object({}).passthrough().optional(),
  notes: z.string().optional(),
  backstory: z.string().optional(),
  treasure: z.string().optional(),
  alliesOrgs: z.string().optional(),
});

const partialPlayerCharacterSchema = playerCharacterSchema.partial();

async function createEntityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const body = request.body as any;
    const parsedEntity = entitySchema.parse(body);
    const playerData = body.playerCharacter
      ? playerCharacterSchema.parse(body.playerCharacter)
      : null;

    const [newEntity] = await db
      .insert(entity)
      .values(parsedEntity)
      .returning();

    if (parsedEntity.type === "player" && newEntity && playerData) {
      const {
        playerName,
        level,
        characterClass,
        background,
        alignment,
        experience,
        inspiration,
        personality,
        notes,
        backstory,
        treasure,
        alliesOrgs,
      } = playerData;
      if (playerName && level !== undefined && characterClass) {
        await db.insert(playerCharacter).values({
          id: newEntity.id,
          playerName,
          level,
          characterClass,
          background,
          alignment,
          experience,
          inspiration,
          personality,
          notes,
          backstory,
          treasure,
          alliesOrgs,
        });
      } else {
        return reply.code(400).send({
          error: "Validation Error",
          details: "Missing required player character fields.",
        });
      }
    }

    if (body.spellIds && Array.isArray(body.spellIds)) {
      await db.insert(entitySpells).values(
        body.spellIds.map((spellId: number) => ({
          entityId: newEntity.id,
          spellId,
        }))
      );
    }

    if (body.itemIds && Array.isArray(body.itemIds)) {
      await db.insert(entityItems).values(
        body.itemIds.map((itemId: number) => ({
          entityId: newEntity.id,
          itemId,
        }))
      );
    }

    if (body.attackIds && Array.isArray(body.attackIds)) {
      await db.insert(entityAttacks).values(
        body.attackIds.map((itemId: number) => ({
          entityId: newEntity.id,
          itemId,
        }))
      );
    }

    return reply.code(201).send(newEntity);
  } catch (err) {
    return reply.code(400).send({
      error: "Validation Error",
      details: err instanceof z.ZodError ? err.errors : err,
    });
  }
}

async function getEntityHandler(request: FastifyRequest, reply: FastifyReply) {
  const { entityId } = request.params as { entityId: number };

  const result = await db
    .select()
    .from(entity)
    .where(eq(entity.id, entityId))
    .then((res) => res[0]);

  if (!result) {
    return reply.code(404).send({ error: "Entity not found" });
  }

  // Fetch associated spells
  const spells = await db
    .select({ spell })
    .from(entitySpells)
    .where(eq(entitySpells.entityId, entityId))
    .leftJoin(spell, eq(entitySpells.spellId, spell.id));

  // Fetch associated items
  const entityItemsResult = await db
    .select({ items })
    .from(entityItems)
    .where(eq(entityItems.entityId, entityId))
    .leftJoin(items, eq(entityItems.itemId, items.id));

  // Fetch associated attacks
  const attacksResult = await db
    .select({ attacks })
    .from(entityAttacks)
    .where(eq(entityAttacks.entityId, entityId))
    .leftJoin(attacks, eq(entityAttacks.attackId, attacks.id));

  let pcData: any = null;
  if (result.type === "player") {
    pcData = await db
      .select()
      .from(playerCharacter)
      .where(eq(playerCharacter.id, entityId))
      .then((res) => res[0]);
  }

  return reply.code(200).send({
    ...result,
    spells: spells.map((s) => s.spell),
    items: entityItemsResult.map((i) => i.items),
    attacks: attacksResult.map((a) => a.attacks),
    ...(pcData ? { playerCharacter: pcData } : {}),
  });
}

async function getEntitySummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { entityId } = request.params as { entityId: number };

  const result = await db
    .select({
      id: entity.id,
      name: entity.name,
      hp: entity.hp,
      maxHp: entity.maxhp, // note: your schema uses lowercase `maxhp`
      ac: entity.ac,
      stats: entity.stats,
      speed: entity.speed,
      passivePerception: entity.passivePerception,
      spellcasting: entity.spellcasting,
      type: entity.type, // we use this to conditionally fetch PC data
    })
    .from(entity)
    .where(eq(entity.id, entityId))
    .then((res) => res[0]);

  if (!result) {
    return reply.code(404).send({ error: "Entity not found" });
  }

  // If it's a player, pull additional PC data
  let pcData: { level: number; characterClass: string } | null = null;

  if (result.type === "player") {
    pcData = await db
      .select({
        level: playerCharacter.level,
        characterClass: playerCharacter.characterClass,
      })
      .from(playerCharacter)
      .where(eq(playerCharacter.id, entityId))
      .then((res) => res[0] ?? null);
  }

  // Return selected fields + PC data if applicable
  const {
    type, // exclude type from final response
    ...baseData
  } = result;

  return reply.code(200).send({
    ...baseData,
    ...(pcData
      ? { level: pcData.level, characterClass: pcData.characterClass }
      : {}),
  });
}

export async function fetchEntities(entityIds: number[]) {
  const results = await Promise.all(
    entityIds.map(async (id) => {
      // mimic getEntitySummaryHandler behavior
      const result = await db
        .select({
          id: entity.id,
          name: entity.name,
          hp: entity.hp,
          maxHp: entity.maxhp,
          ac: entity.ac,
          stats: entity.stats,
          speed: entity.speed,
          passivePerception: entity.passivePerception,
          spellcasting: entity.spellcasting,
          type: entity.type,
        })
        .from(entity)
        .where(eq(entity.id, id))
        .then((res) => res[0]);

      if (!result) return null;

      if (result.type === "player") {
        const pc = await db
          .select({
            level: playerCharacter.level,
            characterClass: playerCharacter.characterClass,
          })
          .from(playerCharacter)
          .where(eq(playerCharacter.id, id))
          .then((res) => res[0]);
        return { ...result, ...pc };
      }

      return result;
    })
  );

  return results.filter(Boolean); // remove nulls
}

async function getEntityIdsByUserHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { userId } = request.params as { userId: number };

  const entityIds = await db
    .select({ id: entity.id, name: entity.name })
    .from(entity)
    .where(eq(entity.createdBy, userId));

  return reply.code(200).send(entityIds.map((e) => e.id));
}

async function updateEntityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Access fastify instance via 'this'
  const fastify = this as any;

  const { entityId } = request.params as { entityId: number };
  const body = request.body as any;

  let parsedEntity, parsedPC;
  try {
    parsedEntity = partialEntitySchema.parse(body);
    parsedPC = body.playerCharacter
      ? partialPlayerCharacterSchema.parse(body.playerCharacter)
      : null;
  } catch (err) {
    return reply.code(400).send({
      error: "Validation Error",
      details: err instanceof z.ZodError ? err.errors : err,
    });
  }

  if (!Object.keys(parsedEntity).length && !parsedPC) {
    return reply.code(400).send({ error: "No fields provided for update" });
  }

  const [updatedEntity] = await db
    .update(entity)
    .set(parsedEntity)
    .where(eq(entity.id, entityId))
    .returning();

  if (!updatedEntity) {
    return reply.code(404).send({ error: "Entity not found" });
  }

  if (updatedEntity.type === "player" && parsedPC) {
    await db
      .update(playerCharacter)
      .set(parsedPC)
      .where(eq(playerCharacter.id, entityId));
  }

  // Get all folders (campaigns) this entity is in
  const folderLinks = await db
    .select({ folderId: folderItems.folderId })
    .from(folderItems)
    .where(eq(folderItems.refId, entityId));

  // Emit to all related campaign rooms
  if (folderLinks.length && fastify?.io) {
    for (const { folderId } of folderLinks) {
      fastify.io.to(`campaign-${folderId}`).emit("entityUpdated", {
        entityId,
        updatedEntity: { ...updatedEntity, ...(parsedPC ?? {}) },
      });
    }
  }

  return reply.code(200).send({ ...updatedEntity });
}

async function deleteEntityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { entityId } = request.params as { entityId: number };

  const entityData = await db
    .select()
    .from(entity)
    .where(eq(entity.id, entityId))
    .then((res) => res[0]);

  if (!entityData) {
    return reply.code(404).send({ error: "Entity not found" });
  }

  // Start transaction
  await db.transaction(async (trx) => {
    if (entityData.type === "player") {
      await trx.delete(playerCharacter).where(eq(playerCharacter.id, entityId));
    }

    // Delete related folder items
    await trx.delete(folderItems).where(eq(folderItems.refId, entityId));

    // Delete entity
    await trx.delete(entity).where(eq(entity.id, entityId));
  });

  return reply.code(204).send();
}

async function addEntityToFolderHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { entityId, folderId, position } = request.body as {
    entityId: number;
    folderId: number;
    position?: number;
  };

  // Check that folder exists
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, folderId),
  });

  if (!folder) {
    return reply.code(404).send({ error: "Folder not found" });
  }

  // Check that entity exists and fetch its type
  const entityResult = await db
    .select({
      id: entity.id,
      type: entity.type,
    })
    .from(entity)
    .where(eq(entity.id, entityId))
    .then((res) => res[0]);

  if (!entityResult) {
    return reply.code(404).send({ error: "Entity not found" });
  }

  const detectedType = entityResult.type === "player" ? "player" : "entity";

  // Determine final position
  let finalPosition = position;
  if (finalPosition === undefined) {
    const [{ count }] = await db
      .select({ count: drizzleCount() })
      .from(folderItems)
      .where(eq(folderItems.folderId, folderId));
    finalPosition = Number(count);
  }

  // Insert into folderItems with the correct type
  const [newItem] = await db
    .insert(folderItems)
    .values({
      folderId,
      type: detectedType,
      refId: entityId,
      position: finalPosition,
    })
    .returning();

  return reply
    .code(201)
    .send({ message: `${detectedType} added to folder`, item: newItem });
}
export default entityRoutes;
