import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { entity } from "../models/entity";
import { eq } from "drizzle-orm";
import { z } from "zod";

const entitiesRoutes: FastifyPluginAsync = async (fastify) => {
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

async function createEntityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Validate and parse body
    const parsedBody = entitySchema.parse(request.body);

    const [newEntity] = await db.insert(entity).values(parsedBody).returning();

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

  return reply.code(200).send(result);
}

async function updateEntityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { entityId } = request.params as { entityId: number };

  // Validate the input as a partial entity
  let parsedBody;
  try {
    parsedBody = partialEntitySchema.parse(request.body);
  } catch (err) {
    return reply.code(400).send({
      error: "Validation Error",
      details: err instanceof z.ZodError ? err.errors : err,
    });
  }

  if (Object.keys(parsedBody).length === 0) {
    return reply.code(400).send({ error: "No fields provided for update" });
  }

  const [updatedEntity] = await db
    .update(entity)
    .set(parsedBody)
    .where(eq(entity.id, entityId))
    .returning();

  if (!updatedEntity) {
    return reply.code(404).send({ error: "Entity not found" });
  }

  return reply.code(200).send(updatedEntity);
}

async function deleteEntityHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { entityId } = request.params as { entityId: number };

  const deleted = await db
    .delete(entity)
    .where(eq(entity.id, entityId))
    .returning();

  if (deleted.length === 0) {
    return reply.code(404).send({ error: "Entity not found" });
  }

  return reply.code(204).send();
}

export default entitiesRoutes;
