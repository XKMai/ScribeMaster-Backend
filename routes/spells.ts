import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { spell } from "../models/spell";
import { eq } from "drizzle-orm";

const spellsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", createSpellHandler);
  fastify.get("/:spellId", getSpellHandler);
  fastify.patch("/:spellId", updateSpellHandler);
  fastify.delete("/:spellId", deleteSpellHandler);
};

async function createSpellHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const {
    name,
    level,
    school,
    castingTime,
    range,
    components,
    duration,
    description,
    higherLevel,
    classes,
    createdBy,
    settings,
  } = request.body as {
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    components: string[];
    duration: string;
    description: string;
    higherLevel: string;
    classes: string[];
    createdBy: number;
    settings?: Record<string, any>;
  };

  const [createdSpell] = await db
    .insert(spell)
    .values({
      name,
      level,
      school,
      castingTime,
      range,
      components,
      duration,
      description,
      higherLevel,
      classes,
      createdBy,
      settings: settings ?? {},
    })
    .returning();

  return reply.code(201).send(createdSpell);
}

async function getSpellHandler(request: FastifyRequest, reply: FastifyReply) {
  const { spellId } = request.params as { spellId: number };

  const spellRecord = await db
    .select()
    .from(spell)
    .where(eq(spell.id, spellId))
    .then((results) => results[0]);

  if (!spellRecord) {
    return reply.code(404).send({ error: "Spell not found" });
  }

  return reply.code(200).send(spellRecord);
}

async function updateSpellHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { spellId } = request.params as { spellId: number };
  const {
    name,
    level,
    school,
    castingTime,
    range,
    components,
    duration,
    description,
    higherLevel,
    classes,
    settings,
  } = request.body as Partial<{
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    components: string[];
    duration: string;
    description: string;
    higherLevel: string;
    classes: string[];
    settings: Record<string, any>;
  }>;

  const [updatedSpell] = await db
    .update(spell)
    .set({
      name,
      level,
      school,
      castingTime,
      range,
      components,
      duration,
      description,
      higherLevel,
      classes,
      settings,
    })
    .where(eq(spell.id, spellId))
    .returning();

  if (!updatedSpell) {
    return reply.code(404).send({ error: "Spell not found" });
  }

  return reply.code(200).send(updatedSpell);
}

async function deleteSpellHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { spellId } = request.params as { spellId: number };

  const deleted = await db
    .delete(spell)
    .where(eq(spell.id, spellId))
    .returning();

  if (deleted.length === 0) {
    return reply.code(404).send({ error: "Spell not found" });
  }

  return reply.code(204).send();
}

export default spellsRoutes;
