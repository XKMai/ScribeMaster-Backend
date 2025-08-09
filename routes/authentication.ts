import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { users } from "../models/users";
import bcrypt from "bcrypt";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register Handler
  fastify.post("/register", registerHandler);
  fastify.post("/logout", logout);

  // Login Handler
  fastify.post(
    "/login",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { identifier, password } = request.body as {
        identifier: string; // username or email
        password: string;
      };

      const raw = (identifier ?? "").trim();
      const looksLikeEmail = raw.includes("@");
      const normalized = looksLikeEmail ? raw.toLowerCase() : raw;

      // Find the user by username OR email
      const user = await db.query.users.findFirst({
        where: (u, { or, eq }) =>
          or(eq(u.name, normalized), eq(u.email, normalized)),
      });

      const isMatch = user && (await bcrypt.compare(password, user.password));

      if (!user || !isMatch) {
        return reply.code(401).send({ message: "Invalid credentials" });
      }

      const token = fastify.jwt.sign({ id: user.id, name: user.name });

      reply.setCookie("Authorization", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // true in prod
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
  let { name, email, password } = request.body as {
    name: string;
    email: string;
    password: string;
  };

  name = name.trim();
  //Email to lowercase for standardization
  email = email.trim().toLowerCase();

  const existingUser = await db.query.users.findFirst({
    where: (u, { or, eq }) => or(eq(u.name, name), eq(u.email, email)),
  });

  if (existingUser) {
    return reply.code(409).send({
      message: "User already exists with this username or email",
    });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.insert(users).values({ name, email, password: hash });
    return reply.code(201).send({ message: "User registered" });
  } catch (e) {
    return reply.code(500).send({ message: "Internal server error" });
  }
}

async function logout(request: FastifyRequest, reply: FastifyReply) {
  // Clear the cookie
  return reply
    .clearCookie("Authorization", {
      path: "/", // Must match the path used when setting the cookie
      httpOnly: true, // Matches original
      sameSite: "lax", // Matches original
      secure: false, // Matches original (change to true in production)
    })
    .code(200);
}

export default authRoutes;
