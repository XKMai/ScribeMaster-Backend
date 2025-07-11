import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { users } from "../models/users";
import bcrypt from "bcrypt";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register Handler
  fastify.post("/register", registerHandler);
  fastify.get("/logout", logout);

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

      const token = fastify.jwt.sign({ id: user.id, name });

      // Set the token in a secure cookie
      reply.setCookie("Authorization", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
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
      const user = request.user as { id: number; name: string };
      return { user: { id: user.id, name: user.name } };
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

async function logout(request: FastifyRequest, reply: FastifyReply) {
  // Clear the cookie
  reply.clearCookie("Authorization", {
    path: "/", // Must match the path used when setting the cookie
    httpOnly: true, // Matches original
    sameSite: "lax", // Matches original
    secure: false, // Matches original (change to true in production)
  });

  return reply.code(200);
}

export default authRoutes;
