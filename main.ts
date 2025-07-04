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
    // const io = new Server(fastify.server, {
    //   cors: {
    //     origin:
    //       "http://scribemaster-frontend-alb-469534981.ap-southeast-1.elb.amazonaws.com:5173",
    //     credentials: true,
    //   },
    // });

    // Store entities for each room
    // const roomEntities: Record<string, any[]> = {};

    // fastify.decorate("io", io);

    // io.on("connection", (socket) => {
    //   console.log(`Socket connected: ${socket.id}`);

    //   // Join a campaign room
    //   socket.on("joinCampaign", (folderId: number) => {
    //     const room = `campaign-${folderId}`;
    //     socket.join(room);

    //     console.log(`Socket ${socket.id} joined room ${room}`);

    //     // Initialize if it doesn't exist
    //     if (!roomEntities[room]) {
    //       roomEntities[room] = [];
    //     }

    //     // Send current room entities to the new socket
    //     socket.emit("currentEntities", roomEntities[room]);
    //   });

    //   // Add entity to the room
    //   socket.on("addEntity", ({ folderId, entity }) => {
    //     const room = `campaign-${folderId}`;
    //     if (!roomEntities[room]) {
    //       roomEntities[room] = [];
    //     }

    //     roomEntities[room].push(entity);

    //     // Notify all clients in the room of the new entity
    //     io.to(room).emit("entityAdded", entity);
    //   });

    //   // Remove entity from the room
    //   socket.on("removeEntity", ({ folderId, entityId }) => {
    //     const room = `campaign-${folderId}`;
    //     if (roomEntities[room]) {
    //       roomEntities[room] = roomEntities[room].filter(
    //         (e) => e.id !== entityId
    //       );

    //       io.to(room).emit("entityRemoved", entityId);
    //     }
    //   });

    //   // Update entity in the room
    //   socket.on("updateEntity", ({ folderId, entity }) => {
    //     const room = `campaign-${folderId}`;
    //     if (roomEntities[room]) {
    //       const index = roomEntities[room].findIndex((e) => e.id === entity.id);
    //       if (index !== -1) {
    //         roomEntities[room][index] = entity;

    //         io.to(room).emit("entityUpdated", entity);
    //       }
    //     }
    //   });

    //   socket.on("disconnect", () => {
    //     console.log(`❌ Socket disconnected: ${socket.id}`);
    //   });
    // });
    const address = await fastify.listen({
      port: PORT,
      host: "0.0.0.0",
    });

    // console.log(`🚀 Server running at ${address}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start();
