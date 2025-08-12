import { FastifyPluginAsync } from "fastify";
import { db } from "../database/database";
import { users } from "../models/users";
import { eq } from "drizzle-orm";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", getUserHandler);
  fastify.get("/:id", getUserByIDHandler);
  fastify.put("/:id", updateUserHandler);
};

//Update a User
async function updateUserHandler(request, reply) {
  const { id } = request.params as { id: number };
  const { name, email } = request.body as { name?: string; email?: string };

  // Update user in the database
  const result = await db
    .update(users)
    .set({ name, email })
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email });

  if (!result || result.length === 0) {
    return reply.code(404).send({ error: "User not found" });
  }

  return reply.code(200).send({ user: result[0] });
}

//Get a User by Name, Probably slower
async function getUserHandler(request, reply) {
  const { name } = request.query as { name: string };

  const result = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.name, name),
  });

  if (!result) {
    return reply.code(404).send({ error: "User not found" });
  }

  return reply.code(200).send({ user: result });
}

//Get a User by ID
async function getUserByIDHandler(request, reply) {
  const { id } = request.params as { id: number };

  const result = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, id),
  });

  if (!result) {
    return reply.code(404).send({ error: "User not found" });
  }

  return reply.code(200).send({ user: result });
}

//Get UserID by Name
async function getUserID(name: string) {
  const result = await db.query.users.findFirst({
    columns: { id: true }, //Selects only the id
    where: (users, { eq }) => eq(users.name, name),
  });
  return result;
}

export default userRoutes;
