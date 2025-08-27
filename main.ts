import Fastify from "fastify";
import userRoutes from "./routes/users";
import fCookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import authRoutes from "./routes/authentication";
import campaignRoutes from "./routes/campaign";
import folderRoutes from "./routes/folder";
import notesRoutes from "./routes/notes";
import entityRoutes from "./routes/entity";
import spellsRoutes from "./routes/spells";
import itemsRoutes from "./routes/items";
import { Server } from "socket.io";
import roomRoutes from "./routes/room"; // Adjust the path if the file is named differently or in another folder

const fastify = Fastify({ logger: true });

const PORT = 5000;

// Register plugins

fastify.register(fCookie, {
  secret: "some-secret-key",
});

fastify.register(jwt, {
  secret: "supersecretstring",
  cookie: {
    cookieName: "Authorization",
    signed: false,
  },
});

fastify.register(cors, {
  origin:
    "http://scribemaster-frontend-alb-469534981.ap-southeast-1.elb.amazonaws.com:5173", //Frontend localhost url
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
fastify.register(
  async function (apiRoutes, opts) {
    apiRoutes.register(userRoutes, { prefix: "/user" });
    apiRoutes.register(authRoutes);
    apiRoutes.register(campaignRoutes, { prefix: "/campaign" });
    apiRoutes.register(folderRoutes, { prefix: "/folder" });
    apiRoutes.register(notesRoutes, { prefix: "/notes" });
    apiRoutes.register(entityRoutes, { prefix: "/entity" });
    apiRoutes.register(spellsRoutes, { prefix: "/spell" });
    apiRoutes.register(itemsRoutes, { prefix: "/item" });
  },
  { prefix: "/api" }
);

// Root route
fastify.get("/", async (request, reply) => {
  reply.send({ hello: "world" });
});

//Health check
fastify.get("/api/health", async () => {
  return {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
});

// Start the server
const start = async () => {
  try {
    const io = new Server(fastify.server, {
      cors: {
        origin:
          "http://scribemaster-frontend-alb-469534981.ap-southeast-1.elb.amazonaws.com:5173",
        credentials: true,
      },
    });

    fastify.decorate("io", io);
    roomRoutes(fastify, io);

    const address = await fastify.listen({
      port: PORT,
      host: "0.0.0.0",
    });

    // console.log(`Server running at ${address}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
