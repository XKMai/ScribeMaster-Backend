import { FastifyPluginAsync } from 'fastify';
import { db } from '../database/database';
import { users } from '../models/user';
import bcrypt from 'bcrypt';

const authRoutes: FastifyPluginAsync = async (fastify) => {

  // Register Handler
  fastify.post("/register", registerHandler);

  // Login Handler
fastify.post("/login", async (request, reply) => {
  const { name, password } = request.body as { name: string; password: string };

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.name, name),
  });

  const isMatch = user && (await bcrypt.compare(password, user.password));

  if (!user || !isMatch) {
    return reply.code(401).send({
      message: 'Invalid name or password',
    });
  }

  const token = fastify.jwt.sign({ name });

  reply.setCookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // only send over HTTPS in prod
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day
  });

  return reply.send({ message: "Login successful" });
});
};

async function registerHandler(request,reply) {
const { name, password } = request.body as { name: string; password: string };

const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.name, name),
});

if (existingUser) {
    return reply.code(401).send({
    message: 'User already exists with this name',
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
