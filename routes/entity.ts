import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { entity, entityItems, entitySpells } from "../models/entity";
import { playerCharacter } from "../models/player";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { spell } from "../models/spell";
import { items } from "../models/items";

const entityRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", createEntityHandler);
  fastify.get("/:entityId", getEntityHandler);
  fastify.patch("/:entityId", updateEntityHandler);
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
    ...(pcData ? { playerCharacter: pcData } : {}),
  });
}

async function updateEntityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
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

  if (entityData.type === "player") {
    await db.delete(playerCharacter).where(eq(playerCharacter.id, entityId));
  }

  await db.delete(entity).where(eq(entity.id, entityId));
  return reply.code(204).send();
}

export default entityRoutes;
