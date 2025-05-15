import Fastify from 'fastify';
import userRoutes from './routes/users';
import fCookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './database/database';
import authRoutes from './routes/authentication';


const fastify = Fastify({ logger: true });

const PORT = 5000;

// Register plugins
fastify.register(jwt, {
  secret: 'supersecretstring',
  cookie: {
    cookieName: 'token',
    signed: false, // or true if you're signing it with @fastify/cookie
  },
});

fastify.register(fCookie, {
  secret: 'some-secret-key',
});


fastify.register(cors, {
  origin: 'http://localhost:5173', //Frontend localhost url
  credentials: true,               
});

// Decorator for protected routes
fastify.decorate("authenticate", async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.send(err);
  }
});

// Register routes
fastify.register(userRoutes, { prefix: '/user' });
fastify.register(authRoutes);

// Root route
fastify.get('/', async (request, reply) => {
  reply.send({ hello: 'world' });
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: PORT });
    console.log(`🚀 Server is running at http://localhost:${PORT}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();

