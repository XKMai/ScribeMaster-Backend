import { FastifyPluginAsync } from "fastify";
import { db } from "../database/database";
import { users } from "../models/users";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", postUserHandler);
  fastify.get("/", getUserHandler);
  fastify.get("/:id", getUserByIDHandler);
};

//Insert a User
async function postUserHandler(request, reply) {
  const { name, password } = request.body as { name: string; password: string };
  const inserted = await db
    .insert(users)
    .values({ name, password })
    .returning();

  return reply.code(201).send({ message: "User inserted", user: inserted[0] });
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
    where: (users, { eq }) => eq(users.id, Number(id)), // convert to number if id is integer
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
