import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { users } from "../models/users";
import bcrypt from "bcrypt";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register Handler
  fastify.post("/register", registerHandler);

  // Login Handler
  fastify.post(
    "/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, password } = request.body as {
        name: string;
        password: string;
      };

      //Finds the user by name
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.name, name),
      });

      const isMatch = user && (await bcrypt.compare(password, user.password));

      if (!user || !isMatch) {
        return reply.code(401).send({
          message: "Invalid name or password",
        });
      }

      const token = fastify.jwt.sign({ name });

      // Set the token in a secure cookie
      reply.setCookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 60 * 60 * 24, // 1 day
      });

      return reply.send({ message: "Login successful", UserId: user.id });
    }
  );

  //Me authenticator Checker
  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as { name: string };
      return { user };
    }
  );
};

async function registerHandler(request, reply) {
  const { name, password } = request.body as { name: string; password: string };

  // Check if the user already exists
  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.name, name),
  });

  if (existingUser) {
    return reply.code(401).send({
      message: "User already exists with this name",
    });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.insert(users).values({ name, password: hash });
    return reply.code(201).send({ message: "User registered" });
  } catch (e) {
    return reply.code(500).send({ message: "Internal server error" });
  }
}

export default authRoutes;
